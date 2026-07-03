import type { Severity, FindingActionKind } from "@devdigest/shared";

/** Sort weight per severity (lower = shown first). Exhaustive over the `Severity` contract. */
export const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUGGESTION: 2,
};

/** Severities shown as counters/filters. `satisfies` keeps this in lock-step with the
 *  `Severity` contract at compile time — without pulling the runtime barrel into the bundle. */
export const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];
export type SeverityLevel = (typeof SEVERITIES)[number];

/** Confidence below this is hidden when "hide low confidence" is on. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Keyboard shortcut → finding action. */
export const KEY_TO_ACTION: Record<string, FindingActionKind> = {
  a: "accept",
  d: "dismiss",
};
