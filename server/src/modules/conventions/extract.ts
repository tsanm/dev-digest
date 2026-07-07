import { and, eq } from 'drizzle-orm';
import type { Container } from '../../platform/container.js';
import type { ChatMessage, ConventionCandidate, Provider, RepoRef } from '@devdigest/shared';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { wrapUntrusted } from '../../platform/prompt.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import * as schema from '../../db/schema.js';
import type { ConventionsRepository, InsertConvention } from './repository.js';
import { groundEvidence, toCandidate, type GroundedItem } from './helpers.js';
import { collectConventionSamples } from './sampling.js';
import {
  Extraction,
  EXTRACTION_SCHEMA_NAME,
  EXTRACTOR_SYSTEM,
  EXTRACT_TASK,
  EXTRACTION_TEMPERATURE,
  EXTRACTION_MAX_RETRIES,
  DEFAULT_PROVIDER,
} from './constants.js';

interface RepoRow {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  clonePath: string | null;
}

/**
 * Single-call convention extraction: select samples in code (configs + top
 * source files), send their bodies (fenced as UNTRUSTED) to one cheap
 * structured LLM call, then GROUND each candidate against the files we read
 * (drop hallucinated paths, cap ungrounded confidence, derive the evidence line).
 */
export async function runExtraction(
  container: Container,
  repo: ConventionsRepository,
  workspaceId: string,
  repoId: string,
  opts: { provider?: Provider; model?: string } = {},
): Promise<ConventionCandidate[]> {
  const repoRow = await loadRepo(container, workspaceId, repoId);
  if (!repoRow.clonePath) {
    throw new AppError('repo_not_cloned', 'Repo is not cloned yet — refresh it first', 409);
  }
  const ref: RepoRef = { owner: repoRow.owner, name: repoRow.name };

  const files = await collectConventionSamples(container, repoId, ref);
  if (files.length === 0) {
    await repo.replaceForRepo(workspaceId, repoId, []);
    return [];
  }

  const resolved = await resolveFeatureModel(container, workspaceId, 'conventions');
  const provider: Provider = opts.provider ?? resolved.provider ?? DEFAULT_PROVIDER;
  const model = opts.model ?? resolved.model;
  const llm = await container.llm(provider);

  const blob = files.map((f) => `FILE: ${f.path}\n${f.content}`).join('\n\n---\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: EXTRACTOR_SYSTEM },
    {
      role: 'user',
      content: `${EXTRACT_TASK(repoRow.owner, repoRow.name)}\n\n${wrapUntrusted('files', blob)}`,
    },
  ];

  const result = await llm.completeStructured<Extraction>({
    model,
    schema: Extraction,
    schemaName: EXTRACTION_SCHEMA_NAME,
    messages,
    temperature: EXTRACTION_TEMPERATURE,
    maxRetries: EXTRACTION_MAX_RETRIES,
  });

  // Ground every candidate against the files we actually read.
  const byPath = new Map(files.map((f) => [f.path, f.content] as const));
  const grounded = result.data.conventions
    .map((c) => groundEvidence(c, byPath))
    .filter((c): c is GroundedItem => c !== null);

  const rows = await repo.replaceForRepo(
    workspaceId,
    repoId,
    grounded.map(
      (g): InsertConvention => ({
        workspaceId,
        repoId,
        category: g.category,
        rule: g.rule,
        evidencePath: g.evidence_path,
        evidenceSnippet: g.evidence_snippet,
        evidenceLine: g.evidence_line,
        confidence: g.confidence,
      }),
    ),
  );
  return rows.map(toCandidate);
}

export async function loadRepo(
  container: Container,
  workspaceId: string,
  repoId: string,
): Promise<RepoRow> {
  const [row] = await container.db
    .select({
      id: schema.repos.id,
      owner: schema.repos.owner,
      name: schema.repos.name,
      fullName: schema.repos.fullName,
      clonePath: schema.repos.clonePath,
    })
    .from(schema.repos)
    .where(and(eq(schema.repos.workspaceId, workspaceId), eq(schema.repos.id, repoId)));
  if (!row) throw new NotFoundError('Repo not found');
  return row;
}
