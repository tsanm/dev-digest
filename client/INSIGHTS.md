# Insights — client

Non-obvious findings and gotchas for `@devdigest/web`. Add an entry whenever something
surprised you, so the next session doesn't relearn it. **Append-only** — see the
`engineering-insights` skill for how entries are captured.

## What Works

## What Doesn't Work

## Codebase Patterns

- **2026-07-03** — Findings filtering is centralized in `visibleFindings()` and the filter state lives in `FindingsPanel` (`hideLow`, `severity`). Add a new finding filter by extending that helper + lifting a state var beside `hideLow`; compute any per-severity tally over the SAME hide-low-filtered base (`afterHideLow`) so the counter always matches the rendered list. Evidence: `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/helpers.ts`.
- **2026-07-03** — Client `SEV_COLOR`/`SEVERITY_ORDER` list an `INFO` level, but the shared `Severity` contract is only `CRITICAL|WARNING|SUGGESTION`, so a 3-way severity tally is exhaustive (sum == list length) — no orphan INFO findings. Evidence: `FindingCard/constants.ts` vs `vendor/shared/contracts/findings.ts`.
- **2026-07-03** — Deliberate: the severity counter tallies the SAME population `FindingsPanel` renders (post-hide-low), which **includes dismissed findings** (rendered muted, not removed) — so "counters match the list" holds by construction. This is intentionally distinct from `ReviewRunAccordion`'s `blockers` (live, non-dismissed CRITICALs); the two measure different things. Evidence: `FindingsPanel/helpers.ts` (`severityCounts`/`afterHideLow`) vs `ReviewRunAccordion/ReviewRunAccordion.tsx:56`.

## Tool & Library Notes

- **2026-07-03** — `@devdigest/ui` `Toggle` renders `role="switch"` (`aria-checked`), not a checkbox — query it in RTL via `getByRole("switch")`. Evidence: `src/vendor/ui/primitives/Toggle.tsx:13`.

## Recurring Errors & Fixes

## Session Notes

### 2026-07-03
- Built the HW-1 feature: per-run **severity counter + click-to-filter** in `FindingsPanel` (`SeverityCounts.tsx` chips + `severity` state + `severityCounts()`), reusing `SEV_COLOR` and the existing `hideLow` seam. Client-only, no server/contract change, zero new LLM calls.
- Decision: counter tallies over the hide-low-filtered set; filter composes (AND) with `hideLow`; zero-count chips render but are disabled; clicking the active chip clears.

## Open Questions
