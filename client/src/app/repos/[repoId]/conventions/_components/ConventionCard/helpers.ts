import { HIGH_CONFIDENCE } from "./constants";

/** Map a 0..1 confidence to a token colour for the progress bar. */
export function confidenceColor(confidence: number): string {
  return confidence >= HIGH_CONFIDENCE ? "var(--ok)" : "var(--warn)";
}

/** Best-effort copy of a snippet to the clipboard (no-op if unavailable). */
export function copySnippet(snippet: string): void {
  navigator.clipboard?.writeText(snippet);
}

/** End line of a snippet given its 1-based start line (for a `path:start-end` GitHub range). */
export function evidenceEndLine(startLine: number, snippet: string): number {
  return startLine + Math.max(1, snippet.trim().split("\n").length) - 1;
}
