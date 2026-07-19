/**
 * Review module constants.
 */

/**
 * Studio review strategy. 'single-pass' = send the WHOLE diff in ONE LLM call.
 * We deliberately do NOT use 'auto'/map-reduce by default: map-reduce makes one
 * call PER FILE, which is slow and fragile (any single file's transient 5xx
 * fails the entire run) and unnecessary — the whole diff already fits the
 * model's context.
 */
export const REVIEW_STRATEGY = 'single-pass' as const;

// ---- Smart Diff (L03) — risk-ordered diff layout -------------------------
// Thresholds + classification patterns live HERE (never inline in the
// classifier/composer) so they are auditable and tunable in one place.

/** Group render order — core first (business logic), boilerplate last. */
export const SMART_DIFF_ROLES = ['core', 'wiring', 'boilerplate'] as const;

/** A PR is "too big" (→ split nudge) above either threshold. */
export const SPLIT_TOO_BIG_LINES = 400;
export const SPLIT_TOO_BIG_FILES = 12;

/**
 * Boilerplate = generated / mechanical (skim). Lock-files ALWAYS match here, so
 * they are always classified boilerplate (and collapsed by default in the UI).
 */
export const BOILERPLATE_RE =
  /(package\.json|package-lock|pnpm-lock|yarn\.lock|tsconfig|\.lock$|\.snap$|\.md$|license|\.gitignore|dist\/|\.generated\.|migrations?\/)/;

/** Wiring = configs / index / route / module glue that hooks core into the app. */
export const WIRING_RE =
  /(index\.(ts|js)|routes?\.|config\.|\.module\.|setup\.|wiring|register|barrel|exports?\.)/;
