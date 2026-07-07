import type { Container } from '../../platform/container.js';
import type { RepoRef } from '@devdigest/shared';
import { CONFIG_CANDIDATE_PATHS, MAX_SAMPLE_FILES, MAX_FILE_BYTES, SAMPLE_BYTE_BUDGET } from './constants.js';

export interface SampleFile {
  path: string;
  content: string;
}

/**
 * Deterministic, code-only sample selection (N4-bounded): probe the real config
 * files (eslint/tsconfig/prettier — the highest-signal convention source) then
 * add the top-ranked source files (via repo-intel import rank). No model call.
 * Each body is capped at MAX_FILE_BYTES and the total at SAMPLE_BYTE_BUDGET.
 */
export async function collectConventionSamples(
  container: Container,
  repoId: string,
  ref: RepoRef,
): Promise<SampleFile[]> {
  const out: SampleFile[] = [];
  const seen = new Set<string>();
  let total = 0;

  const add = async (path: string): Promise<boolean> => {
    if (seen.has(path) || total >= SAMPLE_BYTE_BUDGET) return false;
    seen.add(path);
    const raw = await container.git.readFile(ref, path).catch(() => '');
    if (!raw.trim()) return false;
    const content = raw.slice(0, MAX_FILE_BYTES);
    out.push({ path, content });
    total += content.length;
    return true;
  };

  // 1. config files (highest signal — a config literally encodes conventions)
  for (const p of CONFIG_CANDIDATE_PATHS) await add(p);

  // 2. top-ranked source files (import-graph rank; degrades to [] cleanly)
  let ranked: string[] = [];
  try {
    ranked = await container.repoIntel.getConventionSamples(repoId, MAX_SAMPLE_FILES);
  } catch {
    /* repo-intel off/unindexed → configs only */
  }
  let srcCount = 0;
  for (const p of ranked) {
    if (srcCount >= MAX_SAMPLE_FILES) break;
    if (await add(p)) srcCount++;
  }

  // 3. fallback: repo-intel has no ranked paths yet (unindexed) → sample via the
  //    code index's declared symbols so extraction still works.
  if (srcCount === 0) {
    try {
      const symbols = await container.codeIndex.symbols(ref);
      const symPaths = [...new Set(symbols.map((s) => s.path))];
      for (const p of symPaths) {
        if (srcCount >= MAX_SAMPLE_FILES) break;
        if (await add(p)) srcCount++;
      }
    } catch {
      /* index unavailable → configs only */
    }
  }
  return out;
}
