# Insights — reviewer-core

Non-obvious findings and gotchas for `@devdigest/reviewer-core`. Add an entry whenever something
surprised you, so the next session doesn't relearn it. **Append-only** — see the
`engineering-insights` skill for how entries are captured.

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

## Recurring Errors & Fixes

- **2026-07-03** — OpenRouter reviews failed with `Invalid response body … Premature close` on Node 26: the bundled `undici` (global `fetch`) deterministically aborts OpenRouter's slower **structured** responses ~3.8s in (reproduced 3/3 via the OpenAI SDK; `curl` and `node:https` both succeed 3/3). Fix: give the OpenAI client a `node:https`-based `fetch`. Evidence: `src/llm/openrouter.ts` (`nodeHttpsFetch`).

## Session Notes

### 2026-07-03
- Fixed the OpenRouter `Premature close` (Node 26 undici bug) by routing the OpenAI client through a `node:https` fetch wrapper; live reviews now complete end-to-end. `completeStructured` is non-streaming, so a plain request→buffer→`Response` wrapper suffices (streaming would need more).

## Open Questions
