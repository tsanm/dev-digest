import type { ConventionCandidate } from '@devdigest/shared';
import type { ConventionRow } from './repository.js';
import { UNGROUNDED_CONFIDENCE_CEILING } from './constants.js';

/**
 * Conventions Extractor — pure helpers (grounding, evidence-line derivation,
 * skill-body merge, row→DTO). No I/O, so they unit-test cleanly.
 */

export interface GroundedItem {
  category: string | null;
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
  evidence_line: number | null;
  confidence: number;
}

const normalizeWs = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * 1-based line number where an evidence snippet begins in a file, matching on
 * the snippet's first non-blank line (whitespace-tolerant). `null` if not found
 * (the GitHub link then falls back to the file, no `#L` anchor).
 */
export function deriveEvidenceLine(content: string, snippet: string): number | null {
  const firstLine = snippet
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return null;
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(firstLine)) return i + 1;
  }
  // whitespace-normalized fallback
  const target = normalizeWs(firstLine);
  for (let i = 0; i < lines.length; i++) {
    if (normalizeWs(lines[i]!).includes(target)) return i + 1;
  }
  return null;
}

/** Number of lines a snippet spans (for a `path:start-end` range). */
export function snippetLineSpan(snippet: string): number {
  return Math.max(1, snippet.trim().split('\n').length);
}

/**
 * Ground a candidate against the files we actually read. Unknown path → drop
 * (hallucination). Snippet not found verbatim (whitespace-normalized) → keep but
 * cap confidence (the model may have lightly reformatted). Also derives the
 * 1-based evidence line for the clickable GitHub link.
 */
export function groundEvidence(
  c: {
    category?: string | null;
    rule: string;
    evidence_path: string;
    evidence_snippet: string;
    confidence: number;
  },
  byPath: Map<string, string>,
): GroundedItem | null {
  const content = byPath.get(c.evidence_path);
  if (content === undefined) return null; // hallucinated path → drop
  const found = normalizeWs(c.evidence_snippet).length > 0 && normalizeWs(content).includes(normalizeWs(c.evidence_snippet));
  return {
    category: c.category ?? null,
    rule: c.rule,
    evidence_path: c.evidence_path,
    evidence_snippet: c.evidence_snippet,
    evidence_line: deriveEvidenceLine(content, c.evidence_snippet),
    confidence: found ? c.confidence : Math.min(c.confidence, UNGROUNDED_CONFIDENCE_CEILING),
  };
}

/** kebab-case slug of a rule, for the `## <slug>` skill section headings. */
export function slugify(rule: string): string {
  return (
    rule
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .slice(0, 6)
      .join('-') || 'rule'
  );
}

/** `path:start` or `path:start-end` (end derived from the snippet span). */
export function evidenceRef(path: string, line: number | null, snippet: string): string {
  if (line == null) return path;
  const end = line + snippetLineSpan(snippet) - 1;
  return end > line ? `${path}:${line}-${end}` : `${path}:${line}`;
}

export interface MergeItem {
  rule: string;
  evidencePath: string | null;
  evidenceLine: number | null;
  evidenceSnippet: string | null;
}

/**
 * Merge accepted candidates into ONE directive `repo-conventions` skill body,
 * matching the HW mockup: a `# <name>` heading, an instruction line, then one
 * `## <slug>` section per accepted candidate citing `file:line` + a fenced
 * snippet. Rejected/unaccepted candidates are never passed in.
 */
export function mergeConventionsSkillBody(name: string, repo: string, items: MergeItem[]): string {
  const head =
    `# ${name}\n\n` +
    `House conventions for \`${repo}\`. Flag changes that violate any rule below and ` +
    'cite the offending `file:line`.';
  const sections = items.map((it) => {
    const ref = it.evidencePath ? evidenceRef(it.evidencePath, it.evidenceLine, it.evidenceSnippet ?? '') : null;
    const detected = ref ? `\n\nDetected in \`${ref}\`:\n\`\`\`\n${(it.evidenceSnippet ?? '').trim()}\n\`\`\`` : '';
    return `## ${slugify(it.rule)}\n${it.rule}${detected}`;
  });
  return [head, ...sections].join('\n\n');
}

/** Persisted row → API DTO. */
export function toCandidate(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    category: row.category ?? null,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    evidence_line: row.evidenceLine ?? null,
    confidence: row.confidence ?? 0,
    accepted: row.accepted,
    rejected: row.rejected,
  };
}
