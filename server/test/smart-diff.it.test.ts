import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockLLMProvider } from '../src/adapters/mocks.js';
import type { SmartDiff } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('Smart Diff — GET /pulls/:id/smart-diff (L03)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;
  let llm: MockLLMProvider;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    const [repo] = await pg.handle.db.select().from(t.repos).limit(1);
    repoId = repo!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });
  beforeEach(() => {
    llm = new MockLLMProvider('openrouter', { structured: {} });
  });

  const app = () =>
    buildApp({ config: config(), db: pg.handle.db, overrides: { llm: { openrouter: llm } } });

  let prSeq = 5000;
  /** Seed a PR with the given files [{path,additions,deletions}]. */
  async function seedPr(files: { path: string; additions?: number; deletions?: number }[]) {
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: prSeq++,
        title: 'smart-diff fixture',
        author: 'tester',
        branch: 'feat/x',
        base: 'main',
        headSha: 'deadbeef',
        additions: 0,
        deletions: 0,
        filesCount: files.length,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values(
      files.map((f) => ({
        prId: pr!.id,
        path: f.path,
        additions: f.additions ?? 1,
        deletions: f.deletions ?? 0,
        patch: `@@ -1 +1 @@\n+x`,
      })),
    );
    return pr!;
  }

  /** Seed a persisted review + one finding on file:startLine..endLine. */
  async function seedFinding(prId: string, file: string, startLine: number, endLine: number) {
    const [review] = await pg.handle.db
      .insert(t.reviews)
      .values({ workspaceId, prId, kind: 'review', verdict: 'request_changes', score: 60, model: 'seed' })
      .returning();
    await pg.handle.db.insert(t.findings).values({
      reviewId: review!.id,
      file,
      startLine,
      endLine,
      severity: 'CRITICAL',
      category: 'bug',
      title: 'x',
      rationale: 'x',
      confidence: 0.9,
    });
  }

  const get = async (a: Awaited<ReturnType<typeof buildApp>>, prId: string): Promise<SmartDiff> =>
    (await a.inject({ method: 'GET', url: `/pulls/${prId}/smart-diff` })).json();

  it('R.P0.1 — composes groups ordered core→wiring→boilerplate; only non-empty roles', async () => {
    const a = await app();
    const pr = await seedPr([
      { path: 'src/services/payment.ts' }, // core
      { path: 'src/middleware/ratelimit.ts' }, // core
      { path: 'src/index.ts' }, // wiring
      { path: 'package-lock.json' }, // boilerplate
    ]);
    const sd = await get(a, pr.id);
    expect(sd.groups.map((g) => g.role)).toEqual(['core', 'wiring', 'boilerplate']);
    expect(sd.groups[0]!.files).toHaveLength(2);
    const f = sd.groups[0]!.files[0]!;
    expect(f).toMatchObject({ path: expect.any(String), additions: expect.any(Number), deletions: expect.any(Number) });
    expect(Array.isArray(f.finding_lines)).toBe(true);
    await a.close();
  });

  it('R.P0.2 — finding_lines expanded from the last review (sorted, deduped); no-finding file → []', async () => {
    const a = await app();
    const pr = await seedPr([{ path: 'src/a.ts' }, { path: 'src/b.ts' }]);
    await seedFinding(pr.id, 'src/a.ts', 10, 12);
    const sd = await get(a, pr.id);
    const files = sd.groups.flatMap((g) => g.files);
    expect(files.find((x) => x.path === 'src/a.ts')!.finding_lines).toEqual([10, 11, 12]);
    expect(files.find((x) => x.path === 'src/b.ts')!.finding_lines).toEqual([]);
    await a.close();
  });

  it('R.P0.3 — works before any review: groups returned, all finding_lines empty', async () => {
    const a = await app();
    const pr = await seedPr([{ path: 'src/a.ts' }, { path: 'src/index.ts' }]);
    const sd = await get(a, pr.id);
    expect(sd.groups.length).toBeGreaterThan(0);
    expect(sd.groups.flatMap((g) => g.files).every((f) => f.finding_lines.length === 0)).toBe(true);
    await a.close();
  });

  it('R.P0.4 — makes NO model call (free feature): MockLLM.calls is empty', async () => {
    const a = await app();
    const pr = await seedPr([{ path: 'src/a.ts' }, { path: 'package-lock.json' }]);
    await seedFinding(pr.id, 'src/a.ts', 5, 5);
    await get(a, pr.id);
    expect(llm.calls.length).toBe(0);
    await a.close();
  });

  it('R.P1.1 — split_suggestion: too_big by lines OR files; total_lines = Σ(add+del)', async () => {
    const a = await app();
    // 500 changed lines on one file → too_big by lines
    const big = await seedPr([{ path: 'src/big.ts', additions: 300, deletions: 200 }]);
    const sdBig = await get(a, big.id);
    expect(sdBig.split_suggestion.too_big).toBe(true);
    expect(sdBig.split_suggestion.total_lines).toBe(500);
    expect(sdBig.split_suggestion.proposed_splits.length).toBeGreaterThan(0);

    const small = await seedPr([{ path: 'src/small.ts', additions: 3, deletions: 1 }]);
    const sdSmall = await get(a, small.id);
    expect(sdSmall.split_suggestion.too_big).toBe(false);
    expect(sdSmall.split_suggestion.total_lines).toBe(4);
    expect(sdSmall.split_suggestion.proposed_splits).toEqual([]);
    await a.close();
  });

  it('R.P1.2 — unknown PR → 404', async () => {
    const a = await app();
    const res = await a.inject({
      method: 'GET',
      url: '/pulls/00000000-0000-0000-0000-000000000000/smart-diff',
    });
    expect(res.statusCode).toBe(404);
    await a.close();
  });
});
