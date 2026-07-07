import type { ConventionCandidate } from "@devdigest/shared";

/** kebab-case slug of a rule (mirrors the server `slugify`). */
function slugify(rule: string): string {
  return (
    rule
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 6)
      .join("-") || "rule"
  );
}

function evidenceRef(path: string, line: number | null | undefined, snippet: string): string {
  if (line == null) return path;
  const end = line + Math.max(1, snippet.trim().split("\n").length) - 1;
  return end > line ? `${path}:${line}-${end}` : `${path}:${line}`;
}

/**
 * Client-side preview of the merged `repo-conventions` skill body — mirrors the
 * server `mergeConventionsSkillBody` so the editable preview matches what saves.
 */
export function buildConventionsSkillBody(
  name: string,
  repo: string,
  accepted: ConventionCandidate[],
): string {
  const head =
    `# ${name}\n\n` +
    `House conventions for \`${repo}\`. Flag changes that violate any rule below and ` +
    "cite the offending `file:line`.";
  const sections = accepted.map((c) => {
    const detected = c.evidence_path
      ? `\n\nDetected in \`${evidenceRef(c.evidence_path, c.evidence_line, c.evidence_snippet)}\`:\n\`\`\`\n${c.evidence_snippet.trim()}\n\`\`\``
      : "";
    return `## ${slugify(c.rule)}\n${c.rule}${detected}`;
  });
  return [head, ...sections].join("\n\n");
}

/** Rough token estimate (~4 chars/token) for the editor header. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
