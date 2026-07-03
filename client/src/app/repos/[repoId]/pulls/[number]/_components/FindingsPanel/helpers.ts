import type { FindingRecord } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER, type SeverityLevel } from "./constants";

/** Findings that pass the hide-low-confidence toggle (the population counters + filter share). */
function afterHideLow(findings: FindingRecord[], hideLow: boolean): FindingRecord[] {
  return hideLow ? findings.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD) : findings;
}

/** Optionally drop low-confidence findings, optionally keep one severity, then sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: SeverityLevel | null = null,
): FindingRecord[] {
  let shown = afterHideLow(findings, hideLow);
  if (severity) shown = shown.filter((f) => f.severity === severity);
  return [...shown].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Per-severity tally over the hide-low-filtered set (so counts match the list population). */
export function severityCounts(
  findings: FindingRecord[],
  hideLow: boolean,
): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of afterHideLow(findings, hideLow)) counts[f.severity] += 1;
  return counts;
}
