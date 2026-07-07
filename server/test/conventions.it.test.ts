import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { ConventionsRepository } from '../src/modules/conventions/repository.js';
import type { CodeIndex } from '../src/vendor/shared/adapters.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const F1 = 'src/api/users.ts';
const F2 = 'src/api/errors.ts';
const FILES: Record<string, string> = {
  [F1]: 'export async function getUser(id) {\n  const user = await db.users.find(id);\n  return user;\n}',
  [F2]: 'export function fail(msg) {\n  throw new ApiError(msg);\n}',
};

/** Two grounded candidates (F1, F2) + one hallucinated (dropped by grounding). */
const CONVENTIONS = {
  conventions: [
    { category: 'data-access', rule: 'Use async/await for DB access', evidence_path: F1, evidence_snippet: 'const user = await db.users.find(id);', confidence: 0.91 },
    { category: 'error-handling', rule: 'Throw typed ApiError', evidence_path: F2, evidence_snippet: 'throw new ApiError(msg);', confidence: 0.86 },
    { category: 'x', rule: 'All handlers log to stdout', evidence_path: 'src/does/not/exist.ts', evidence_snippet: 'console.log(x)', confidence: 0.8 },
  ],
};

// Custom code index surfacing BOTH sample files (MockCodeIndex only yields one).
const codeIndex = {
  async grep() { return []; },
  async symbols() {
    return [
      { path: F1, name: 'getUser', kind: 'function', line: 1 },
      { path: F2, name: 'fail', kind: 'function', line: 1 },
    ];
  },
  async references() { return []; },
} as unknown as CodeIndex;

d('Conventions Extractor (Part A)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;
  let agentId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    const [repo] = await pg.handle.db
      .update(t.repos)
      .set({ clonePath: '/mock/clones/acme/payments-api' })
      .where(eq(t.repos.fullName, 'acme/payments-api'))
      .returning();
    repoId = repo!.id;
    const [agent] = await pg.handle.db.select().from(t.agents).limit(1);
    agentId = agent!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });
  beforeEach(async () => {
    await pg.handle.db.delete(t.conventions).where(eq(t.conventions.repoId, repoId));
    await pg.handle.db.delete(t.skills);
    await pg.handle.db.delete(t.agentSkills);
  });

  function make(structured: unknown = CONVENTIONS) {
    const llm = new MockLLMProvider('openai', { structured });
    const app = buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { llm: { openai: llm }, git: new MockGitClient({ files: FILES }), codeIndex },
    });
    return { app, llm };
  }
  const extract = async (app: Awaited<ReturnType<typeof buildApp>>) =>
    (await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract`, payload: {} })).json();

  it('A1/A5/N3: extract grounds real evidence and drops hallucinated candidates', async () => {
    const { app } = make();
    const a = await app;
    const candidates = await extract(a);
    expect(candidates).toHaveLength(2); // hallucinated path dropped
    const users = candidates.find((c: { evidence_path: string }) => c.evidence_path === F1);
    expect(users.confidence).toBeGreaterThan(0.8);
    expect(users.evidence_line).toBe(2); // derived: `const user = await...` is line 2
    expect(users.accepted).toBe(false);
    expect(users.category).toBe('data-access');
    await a.close();
  });

  it('A3: accept and reject persist mutually-exclusive states', async () => {
    const { app } = make();
    const a = await app;
    const [c1, c2] = await extract(a);
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` });
    await a.inject({ method: 'POST', url: `/conventions/${c2.id}/reject` });
    const list = await (await a.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    expect(list.find((x: { id: string }) => x.id === c1.id).accepted).toBe(true);
    expect(list.find((x: { id: string }) => x.id === c2.id).rejected).toBe(true);
    await a.close();
  });

  it('A4: edit a candidate rule + re-ground the snippet', async () => {
    const { app } = make();
    const a = await app;
    const [c1] = await extract(a);
    const res = await a.inject({
      method: 'PUT',
      url: `/conventions/${c1.id}`,
      payload: { rule: 'Always await DB calls', evidence_snippet: 'return user;' },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated.rule).toBe('Always await DB calls');
    expect(updated.evidence_line).toBe(3); // `return user;` is line 3
    await a.close();
  });

  it('A7: create-skill merges ONLY accepted candidates into one repo-conventions skill', async () => {
    const { app } = make();
    const a = await app;
    const [c1, c2] = await extract(a);
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` });
    await a.inject({ method: 'POST', url: `/conventions/${c2.id}/reject` });
    const res = await a.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload: {} });
    expect(res.statusCode).toBe(200);
    const skillId = res.json().skill_id;
    const [skill] = await pg.handle.db.select().from(t.skills).where(eq(t.skills.id, skillId));
    expect(skill!.source).toBe('extracted');
    expect(skill!.type).toBe('convention');
    expect(skill!.name).toBe('payments-api-conventions');
    expect(skill!.body).toContain('Use async/await'); // accepted
    expect(skill!.body).not.toContain('typed ApiError'); // rejected → excluded
    await a.close();
  });

  it('A7b: SEVERAL skills — different accepted subsets produce distinct skills', async () => {
    const { app } = make();
    const a = await app;
    const [c1, c2] = await extract(a);

    // skill #1 from c1 only
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` });
    const s1 = (
      await a.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload: { name: 'skill-one' } })
    ).json().skill_id;

    // switch selection to c2 only (accept toggles c1 off), then skill #2
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` }); // toggle off
    await a.inject({ method: 'POST', url: `/conventions/${c2.id}/accept` });
    const s2 = (
      await a.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload: { name: 'skill-two' } })
    ).json().skill_id;

    expect(s1).not.toBe(s2);
    const skills = await pg.handle.db.select().from(t.skills);
    expect(skills).toHaveLength(2);
    const b1 = skills.find((x) => x.id === s1)!.body;
    const b2 = skills.find((x) => x.id === s2)!.body;
    expect(b1).toContain('async/await'); // c1
    expect(b1).not.toContain('ApiError');
    expect(b2).toContain('ApiError'); // c2
    expect(b2).not.toContain('async/await');
    await a.close();
  });

  it('A8: create-skill can link to an agent (surfaced in the agent skill links)', async () => {
    const { app } = make();
    const a = await app;
    const [c1] = await extract(a);
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` });
    const res = await a.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { agent_id: agentId },
    });
    const skillId = res.json().skill_id;
    const links = await (await a.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();
    expect(links.some((l: { skill_id: string }) => l.skill_id === skillId)).toBe(true);
    await a.close();
  });

  it('N5: re-extract preserves accepted candidates', async () => {
    const { app } = make();
    const a = await app;
    const [c1] = await extract(a);
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` });
    await extract(a); // re-scan
    const list = await (await a.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    expect(list.some((x: { accepted: boolean }) => x.accepted)).toBe(true);
    await a.close();
  });

  it('N9: only extract calls the model — list/accept/reject/edit/create-skill do not', async () => {
    const { app, llm } = make();
    const a = await app;
    const [c1, c2] = await extract(a);
    expect(llm.calls.length).toBe(1);
    await a.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    await a.inject({ method: 'POST', url: `/conventions/${c1.id}/accept` });
    await a.inject({ method: 'POST', url: `/conventions/${c2.id}/reject` });
    await a.inject({ method: 'PUT', url: `/conventions/${c1.id}`, payload: { rule: 'x' } });
    await a.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload: {} });
    expect(llm.calls.length).toBe(1); // unchanged
    await a.close();
  });

  it('N6: repository queries are workspace-scoped (no cross-workspace read)', async () => {
    const repo = new ConventionsRepository(pg.handle.db);
    const [row] = await repo.replaceForRepo(workspaceId, repoId, [
      { workspaceId, repoId, category: null, rule: 'r', evidencePath: F1, evidenceSnippet: 'x', evidenceLine: 1, confidence: 0.9 },
    ]);
    const other = await repo.getById('00000000-0000-0000-0000-000000000000', row!.id);
    expect(other).toBeUndefined();
  });
});
