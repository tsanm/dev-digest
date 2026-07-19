# HW-4 — Smart Diff (risk-ordered diff layout)

Groups a PR's changed files by risk — **core** (business logic) on top, **wiring**
next, **boilerplate** (lock-files, generated) last and collapsed — with a clickable
**"N findings"** badge that jumps to the flagged diff line. **Deterministic and
free**: it composes data DevDigest already has (`pr_files` + persisted `findings`)
into the `SmartDiff` contract — **zero new LLM calls**.

## Acceptance criteria

| Criterion | ✅ |
|---|---|
| lock-file ALWAYS → boilerplate + collapsed by default | `BOILERPLATE_RE` + `defaultOpen=first-group-only` |
| core files on top | groups emitted core → wiring → boilerplate |
| "N findings" badge, clickable → diff line | FileCard badge → `scrollToDiffLine` (CodeLine anchors) |
| NO new model call — free per tokens | no `llm` reference; asserted by test `R.P0.4` |
| thresholds in constants, not hardcoded | `reviews/constants.ts` (`SPLIT_TOO_BIG_*`, `BOILERPLATE_RE`, `WIRING_RE`) |
| `pnpm verify:l03` green | root script → typechecks + 22 tests, exit 0 |

## What's in it

- **Server** (`reviews` module): `classifyFile()` core/wiring/boilerplate; `smart-diff.ts`
  composer (finding-line overlay, split nudge when >400 lines / >12 files, best-effort
  import-rank demotion); `GET /pulls/:id/smart-diff` route.
- **Client**: `SmartDiffViewer` (role groups, boilerplate collapsed, split nudge);
  **Files-changed** tab gains a **Smart / Original order** toggle (Smart default);
  additive `DiffViewer` enhancement — line anchors + clickable finding badge.

## Tests (all green)

`pnpm verify:l03` → **22**: classifier **5** · route/composition **6** (incl. the
no-LLM guarantee) · viewer **4** · finding-badge **3** · tab toggle **2** · +
contract lock-step. Full regression clean (server 106, reviewer-core 23, client 30).

## Notes (finding-quality / conclusions)

- Smart Diff is a pure projection — no model call — so it is instant and free; the
  cost already lived in the Structured Reviewer. Verified live: 0 new LLM calls.
- Path heuristics classify ~all real files correctly; lock-files are pinned to
  boilerplate by regex so the reviewer never wastes attention on them.
- The finding overlay reuses persisted review findings, so the risk layout and the
  reviewer's findings stay in one place — click a badge, land on the exact line.

Design + TDD: `docs/plans/hw4/{01-analysis-and-tdd,02-implementation-plan}.md`.
