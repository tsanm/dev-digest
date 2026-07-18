# HW-4 — Smart Diff — Analysis & TDD

Course: Neoversity AI-Agentic-Engineering · Lesson L03 · Product: DevDigest.
This doc = the authoritative analysis + prioritized test plan. Implementation is a
**PORT** of the reference (`origin/reference/full-build`) + tests + wiring.

---

## PART 1 — ANALYSIS

### 1.1 What we build & why
A **risk-ordered diff layout**: the reviewer's eye lands on business logic first, not
the lock-file. Every changed file is classified **core / wiring / boilerplate**;
files are grouped, boilerplate collapsed, and files that the last review flagged get a
clickable **"N findings"** badge that jumps to the diff line.

### 1.2 How it works — 3 sources, ZERO new LLM calls
| Source | Endpoint | Gives | When |
|---|---|---|---|
| PR files | `GET /pulls/:id` (`prFiles`) | `path, additions, deletions, patch` | right after import (no model) |
| Findings | `GET /pulls/:id/reviews` | `file, start_line, end_line, severity` | after first Run Review |
| Contract | `vendor/shared/contracts/brief.ts` → `SmartDiff` | target response shape | — |

**Key principle:** Smart Diff makes **no model call**. The expensive LLM call already
happened in the Structured Reviewer; Smart Diff **deterministically composes** ready
files + ready findings. Layout works before any review; overlay (badges/highlights)
appears only after the first review.

### 1.3 The contract (already in `brief.ts`, both must exist client+server)
```
SmartDiffRole   = 'core' | 'wiring' | 'boilerplate'
SmartDiffFile   = { path, pseudocode_summary?, additions, deletions, finding_lines:int[] }
SmartDiffGroup  = { role, files:SmartDiffFile[] }
SmartDiff       = { groups:SmartDiffGroup[],
                    split_suggestion:{ too_big, total_lines, proposed_splits:[{name,files[]}] } }
```

### 1.4 Deliverables (from the plan + acceptance)
- **D1 — File classification.** `classifyFile(path)` → core/wiring/boilerplate by path
  patterns; **patterns + thresholds in a separate constants file** (hard requirement).
- **D2 — Route `GET /pulls/:id/smart-diff`.** Takes files from the PR + findings from the
  last review, composes the `SmartDiff` shape. No LLM call.
- **D3 — `SmartDiffViewer` component.** Role groups; **boilerplate collapsed by default**;
  **"N findings" badge** on flagged files; **click badge → diff line**; split nudge banner.
- **D4 — "Files changed" tab integration.** Renders SmartDiffViewer with a **Smart order /
  Original order** toggle (per mockup header).
- **D5 — `pnpm verify:l03`** script (typecheck + smart-diff tests) — must be green.
- **D6 — Open PR** with a good description + **3-line finding-quality note** in the HW submission.

### 1.5 Acceptance criteria (verbatim → where satisfied)
| Criterion | Satisfied by |
|---|---|
| Demo video: Smart Diff on mega-PR (core top, lock collapsed), run review, "N findings" badges, click→line | D3 + D4, staged mega-PR |
| Open PR with a good description | D6 |
| **lock-file ALWAYS → boilerplate + collapsed by default** | D1 (`BOILERPLATE_RE` incl. all lock patterns) + D3 (default-collapsed) |
| finding badges clickable → diff line | D3 |
| **run logs show NO new model call** — free feature | D2 (deterministic; NFR test) |
| **thresholds in constants, not hardcoded** | D1 (constants file; NFR test) |
| `pnpm verify:l03` green | D5 |
| big PR: lock collapsed, core on top | D1+D3 |
| run logs after review: no new LLM calls | D2 |
| 3 lines of conclusions in HW notes | D6 |

### 1.6 Codebase grounding (delta = a PORT)
| Piece | Reference (`origin/reference/full-build`) | On current branch |
|---|---|---|
| `SmartDiff` contract | `vendor/shared/contracts/brief.ts` | ✅ EXISTS (both copies) — verify lock-step |
| Classifier + constants | `reviews/helpers.ts` `classifyFile`, `reviews/constants.ts` (`BOILERPLATE_RE`, `WIRING_RE`, `SPLIT_TOO_BIG_LINES=400`, `SPLIT_TOO_BIG_FILES=12`, `SMART_DIFF_ROLES`) | ❌ ABSENT — port |
| Service/composition | `reviews/smart-diff.ts` `smartDiff()` | ❌ ABSENT — port |
| Route | `GET /pulls/:id/smart-diff` in `reviews/routes.ts` | ❌ ABSENT — port |
| Viewer | `_components/SmartDiffViewer/*` (tsx, constants, helpers, styles, test) | ❌ ABSENT — port |
| Deps on current branch | `repo.getPrFiles`, `repo.reviewsForPull` (findings: `file/startLine/endLine`) | ✅ EXIST |
| `repoIntel.getFileRank` (T3 rank demotion) | used, best-effort | verify; degrade to heuristic if absent |
| `verify:l03` npm script | not present anywhere | ❌ CREATE |

### 1.7 Reference classification patterns (authoritative — port verbatim, keep in constants)
```
BOILERPLATE_RE = /(package\.json|package-lock|pnpm-lock|yarn\.lock|tsconfig|\.lock$|\.snap$|\.md$|license|\.gitignore|dist\/|\.generated\.|migrations?\/)/
WIRING_RE      = /(index\.(ts|js)|routes?\.|config\.|\.module\.|setup\.|wiring|register|barrel|exports?\.)/
classifyFile(p): lower-case → BOILERPLATE_RE ? boilerplate : WIRING_RE ? wiring : core   (precedence: boilerplate > wiring > core)
```
Composition: expand each finding `startLine..endLine` into `finding_lines` (sorted, deduped);
`total_lines = Σ(add+del)`; `too_big = total_lines>400 || files>12`; groups emitted only for
non-empty roles in order **core → wiring → boilerplate**. Optional T3: a `core` file whose
import-rank percentile `<80` is demoted to `wiring` (degrade to heuristic if rank unavailable).
> Note: the mockup places `users.ts` under Boilerplate — illustrative only; the classifier
> (above) is the source of truth.

### 1.8 Build order
1. Verify `SmartDiff` contract identical in both `vendor/shared` copies.
2. Port `reviews/constants.ts` additions + `classifyFile` into `reviews/helpers.ts`.
3. Port `reviews/smart-diff.ts` `smartDiff()`; wire `GET /pulls/:id/smart-diff` in `reviews/routes.ts` + service method.
4. Port `SmartDiffViewer/*`; add `smartDiff.*` i18n keys; add `useSmartDiff` hook.
5. Wire into the "Files changed" tab with the Smart/Original toggle.
6. Add `verify:l03` script. Run all gates.
7. Stage a mega-PR + record; open the PR; write the 3-line note.

---

## PART 2 — TDD (prioritized: P0 = must-pass gate, P1 = important)

**ID scheme** `<REQ>.<PRIO>.<n>`. REQs: **C** classify · **R** route/compose · **V** viewer ·
**I** tab-integration · **N** non-functional. Layers: `unit` (hermetic), `it` (testcontainers pg),
`client` (vitest+jsdom).

### C — File classification  (server unit — `reviews/helpers.test.ts`)
| ID | P | Assert (input → expected) |
|---|---|---|
| **C.P0.1** | P0 | **Lock files ALWAYS boilerplate**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `deps/foo.lock` → all `'boilerplate'` *(acceptance)* |
| **C.P0.2** | P0 | Boilerplate patterns: `package.json`, `tsconfig.json`, `x.snap`, `README.md`, `LICENSE`, `.gitignore`, `dist/bundle.js`, `db.generated.ts`, `migrations/0001.sql` → `'boilerplate'` |
| **C.P0.3** | P0 | Wiring patterns: `src/index.ts`, `api/routes.ts`, `src/config.ts`, `app.module.ts`, `setup.ts`, `lib/register.ts`, `exports.ts` → `'wiring'` |
| **C.P1.1** | P1 | Core = business logic: `src/middleware/ratelimit.ts`, `src/api/public/webhooks.ts`, `src/services/payment.ts` → `'core'` |
| **C.P1.2** | P1 | **Precedence + case-insensitive**: `dist/index.js`→boilerplate (not wiring), `migrations/config.sql`→boilerplate, `PACKAGE-LOCK.JSON`→boilerplate, `Src/Config.TS`→wiring |

### R — Route + composition `GET /pulls/:id/smart-diff`  (server `it` unless noted)
| ID | P | Assert |
|---|---|---|
| **R.P0.1** | P0 | Composes `SmartDiff`: given 5 files (2 core, 2 wiring, 1 lock) → `groups` has roles ordered core→wiring→boilerplate, only non-empty roles; each file carries `path/additions/deletions/finding_lines` |
| **R.P0.2** | P0 | **Finding-lines from last review**: a finding `{file:'a.ts', start_line:10, end_line:12}` → smartDiff file `a.ts`.`finding_lines` = `[10,11,12]` (sorted, deduped); a file with no finding → `[]` |
| **R.P0.3** | P0 | **Works before any review**: no reviews → all `finding_lines` empty, groups still returned (layout works, overlay absent) |
| **R.P0.4** | P0 | **NO LLM call** (NFR-critical): `MockLLMProvider.calls.length === 0` after `GET /smart-diff` — the free-feature guarantee *(acceptance)* |
| **R.P1.1** | P1 | **Split nudge**: `total_lines>400` OR `files>12` → `too_big:true` + `proposed_splits` grouped by role; else `too_big:false, proposed_splits:[]`; `total_lines = Σ(add+del)` |
| **R.P1.2** | P1 | Unknown PR → 404; queries workspace-scoped (no cross-workspace file/finding leak) |
| **R.P1.3** | P1 | *(T3, optional)* import-rank demotion: `core` file with percentile `<80` → `'wiring'`; rank source unavailable → heuristic verdict kept |

### V — SmartDiffViewer  (client — `SmartDiffViewer.test.tsx`)
| ID | P | Assert |
|---|---|---|
| **V.P0.1** | P0 | Renders one group per `groups[]` with role label + file-count badge |
| **V.P0.2** | P0 | **Boilerplate collapsed by default; core (first) expanded** — group order core→wiring→boilerplate, only first `defaultOpen` *(acceptance: lock collapsed, core on top)* |
| **V.P0.3** | P0 | **Per-file "N findings" badge** shown only where `finding_lines.length>0`; **badge is clickable and targets the diff line** (onClick → line anchor / DiffViewer scroll) *(acceptance)* |
| **V.P1.1** | P1 | **Split nudge banner** rendered when `too_big` (shows `total_lines` + each proposed split); hidden when `!too_big` |
| **V.P1.2** | P1 | A file with `finding_lines:[]` shows **no** badge; a role with 0 files is not rendered |

### I — "Files changed" tab integration  (client)
| ID | P | Assert |
|---|---|---|
| **I.P0.1** | P0 | Files-changed tab renders `SmartDiffViewer` (**Smart order default**) |
| **I.P0.2** | P0 | **Smart order / Original order toggle** swaps SmartDiffViewer ↔ plain DiffViewer |
| **I.P1.1** | P1 | `useSmartDiff(prId)` calls `GET /pulls/:id/smart-diff`, `enabled` only when `prId` set |

### N — Non-functional guards
| ID | P | Assert | Layer |
|---|---|---|---|
| **N.P0.1** | P0 | **Contract lock-step**: server & client `SmartDiff` zod schemas both `.parse()` the same fixture identically | unit (both pkgs) |
| **N.P0.2** | P0 | **Thresholds/patterns in constants**: `SPLIT_TOO_BIG_LINES/FILES`, `BOILERPLATE_RE`, `WIRING_RE` exported from `constants.ts`; `smart-diff.ts`/`helpers.ts` import them (no inline magic numbers/regex) | unit / grep-guard |
| **N.P0.3** | P0 | **`pnpm verify:l03` green**: script runs typecheck (client+server) + all C/R/V/I tests; exit 0 | script/CI |

### 2.1 Test → acceptance coverage matrix
| Acceptance criterion | Covered by |
|---|---|
| lock always boilerplate + collapsed | C.P0.1, V.P0.2 |
| core files on top | R.P0.1, V.P0.2 |
| "N findings" badge on flagged files | R.P0.2, V.P0.3 |
| badge clickable → diff line | V.P0.3 |
| overlay only after review / layout before | R.P0.3 |
| NO new model call (free feature) | R.P0.4 |
| thresholds in constants | N.P0.2 |
| `verify:l03` green | N.P0.3 |
| split nudge on mega-PR | R.P1.1, V.P1.1 |

### 2.2 Harness notes
- **C / N.P0.2** — hermetic unit (`reviews/helpers.test.ts`), no Docker: `pnpm exec vitest run reviews/helpers`.
- **R** — `*.it.test.ts` (testcontainers pg): seed repo+PR+prFiles+a review; `buildApp({overrides:{llm:{openrouter:new MockLLMProvider(...)}}})`; `app.inject('GET /pulls/:id/smart-diff')`; assert body + `mock.calls.length===0`.
- **V / I** — vitest + jsdom; mock `DiffViewer` (`data-testid="diff-viewer"`), wrap in `NextIntlClientProvider` with `messages/en/prReview.json`.
- **N.P0.1** — import both `@devdigest/shared` copies' `SmartDiff` in a tiny cross-package fixture parse test.
- **verify:l03** — `"verify:l03": "pnpm -C server typecheck && pnpm -C client typecheck && pnpm -C server exec vitest run smart reviews/helpers && pnpm -C client exec vitest run SmartDiffViewer"`.

### 2.3 Test counts (targets)
Classification 5 · Route 7 · Viewer 5 · Integration 3 · Non-functional 3 = **23 tests**
(≥3 P0/P1 per deliverable). Gate: all P0 green + typecheck 0 (client/server/reviewer-core) + `verify:l03` exit 0.
