import type { SkillSource } from '@devdigest/shared';

/**
 * Skills module constants.
 */

/** Heuristic patterns used to infer a skill's type from its name/body on import. */
export const TYPE_PATTERNS = {
  security: /secret|trifecta|injection|ssrf|exfil|security|vuln/,
  convention: /convention|naming|style|house rule|lint/,
  rubric: /rubric|score|grade|severity/,
} as const;

/** Fallback skill name when none can be derived. */
export const DEFAULT_SKILL_NAME = 'imported-skill';

/** Max length for a derived skill name / first-line description. */
export const NAME_MAX_LEN = 200;

/** Default source for a file import. */
export const DEFAULT_IMPORT_SOURCE: SkillSource = 'manual';
