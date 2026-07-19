import type { Container } from '../../platform/container.js';
import type { SmartDiff, SmartDiffFile, SmartDiffRole } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import type { ReviewRepository } from './repository.js';
import { SMART_DIFF_ROLES, SPLIT_TOO_BIG_FILES, SPLIT_TOO_BIG_LINES } from './constants.js';
import { classifyFile } from './helpers.js';

/**
 * Smart Diff (L03) — risk-ordered diff layout.
 *
 * Groups a PR's changed files into core / wiring / boilerplate, annotates each
 * with the line numbers the LAST review flagged, and nudges a split when the PR
 * is too big. Purely DETERMINISTIC: it composes data DevDigest already has
 * (`pr_files` + persisted `findings`). It makes NO model call — the expensive
 * LLM call already happened in the Structured Reviewer, so this feature is free
 * per tokens. Layout works before any review; finding-lines are empty until the
 * first Run Review.
 */
export async function smartDiff(
  container: Container,
  repo: ReviewRepository,
  workspaceId: string,
  prId: string,
): Promise<SmartDiff> {
  const pull = await repo.getPull(workspaceId, prId);
  if (!pull) throw new NotFoundError('Pull request not found');
  const files = await repo.getPrFiles(prId);

  // T3 (best-effort): import-graph rank confirms/demotes a 'core' verdict. A
  // weakly-ranked (percentile < 80) core file is glue → demote to 'wiring'.
  // Feature-detected + guarded: no index / flag off / error → heuristic kept.
  let pctByPath = new Map<string, number>();
  try {
    const ranks = (await container.repoIntel?.getFileRank(pull.repoId, files.map((f) => f.path))) ?? [];
    pctByPath = new Map(ranks.map((r) => [r.path, r.percentile]));
  } catch {
    /* degrade — keep the heuristic verdicts */
  }

  // One anchor line per finding (its start line), from the latest reviews. This
  // is what the "N findings" badge counts and where a click jumps — so the count
  // is the number of FINDINGS, not the number of touched lines (a finding
  // spanning 5 lines is still one finding).
  const reviews = await repo.reviewsForPull(prId);
  const findingLinesByFile = new Map<string, Set<number>>();
  for (const { findings } of reviews) {
    for (const f of findings) {
      const set = findingLinesByFile.get(f.file) ?? new Set<number>();
      set.add(f.startLine);
      findingLinesByFile.set(f.file, set);
    }
  }

  const groups: Record<SmartDiffRole, SmartDiffFile[]> = { core: [], wiring: [], boilerplate: [] };
  let totalLines = 0;
  for (const f of files) {
    const additions = f.additions ?? 0;
    const deletions = f.deletions ?? 0;
    totalLines += additions + deletions;
    let role = classifyFile(f.path);
    if (role === 'core') {
      const pct = pctByPath.get(f.path);
      if (pct !== undefined && pct < 80) role = 'wiring';
    }
    const findingLines = [...(findingLinesByFile.get(f.path) ?? [])].sort((a, b) => a - b);
    groups[role].push({
      path: f.path,
      pseudocode_summary: null,
      additions,
      deletions,
      finding_lines: findingLines,
    });
  }

  const tooBig = totalLines > SPLIT_TOO_BIG_LINES || files.length > SPLIT_TOO_BIG_FILES;
  const nonEmptyRoles = SMART_DIFF_ROLES.filter((role) => groups[role].length > 0);
  const proposed = tooBig
    ? nonEmptyRoles.map((role) => ({ name: `${role} changes`, files: groups[role].map((g) => g.path) }))
    : [];

  return {
    groups: nonEmptyRoles.map((role) => ({ role, files: groups[role] })),
    split_suggestion: { too_big: tooBig, total_lines: totalLines, proposed_splits: proposed },
  };
}
