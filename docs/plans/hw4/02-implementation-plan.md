# HW-4 — Smart Diff — Implementation Plan (staff-level)

Companion to `01-analysis-and-tdd.md` (requirements + 23 tests). This plan says
**how** to build it so it fits DevDigest naturally, honors the quality attributes, and
makes every TDD test pass. Implementation is a **reuse-first port** of
`origin/reference/full-build` + **one deliberate enhancement** (clickable badge→line).

---

## 0. Design thesis & guiding principles

**Thesis:** Smart Diff is a *pure, deterministic projection* of data DevDigest already
has (`prFiles` + persisted `findings`) into the existing `SmartDiff` contract. No new
DB, no migration, no LLM. It slots into the **reviews** module (server) and the
**Files-changed tab** (client) as an additive, backward-compatible layer.

**Non-negotiable quality attributes (each maps to a test):**
| Attribute | How it's guaranteed | Test |
|---|---|---|
| **Cost-free / deterministic** — no new model call | pure function over prFiles+findings; no `container.*llm*` touch | R.P0.4 |
| **Config-driven** — thresholds/patterns not hardcoded | all in `reviews/constants.ts`, imported | N.P0.2 |
| **Graceful degradation** — optional rank never breaks it | `try/catch` around `getFileRank` → heuristic verdict | R.P1.3 |
| **Contract lock-step** — client/server identical | reuse existing `brief.ts` (both copies); cross-parse test | N.P0.1 |
| **Backward-compatible** — never removes existing UX | Files tab keeps an **Original order** view alongside Smart | I.P0.2 |
| **Tenant-safe** — workspace-scoped | route uses `getContext`; repo queries scoped | R.P1.2 |
| **Accessible** — keyboard + labelled controls | groups toggle on Enter/Space; badge is a `button` w/ aria-label | V.P0.2/3 |

**Reuse-first:** the contract, i18n `smartDiff.*` namespace, `getPrFiles`,
`reviewsForPull`, and the whole reference component tree already exist — port them
verbatim where correct; enhance only where the acceptance demands more (click→line).

---

## 1. Architecture & data flow

```
CLIENT (Files-changed tab)                     SERVER (reviews module)
DiffTab ──[Smart│Original toggle]              GET /pulls/:id/smart-diff
   ├─ Original → DiffViewer(files)                └─ ReviewService.smartDiff(ws,prId)
   └─ Smart → SmartDiffViewer(smartDiff,files)        └─ smartDiff(container,repo,ws,prId)   ← pure
        │  useSmartDiff(prId) ──── GET ─────►             ├─ repo.getPrFiles(prId)
        ├─ split nudge (too_big)                          ├─ repo.reviewsForPull(prId) → finding_lines
        ├─ GroupSection ×N (core→wiring→boilerplate)      ├─ classifyFile(path)  [+ optional rank demote]
        │    ├─ collapsible (first open, rest closed)     └─ compose SmartDiff  (NO llm)
        │    ├─ "N findings" badge (clickable) ──┐
        │    └─ DiffViewer(groupFiles)           │
        └─ scrollToDiffLine(path,line) ◄─────────┘  (the one enhancement)
```

No new tables. No migration. No LLM. Everything else is projection + presentation.

---

## 2. Server implementation

### S1 — `server/src/modules/reviews/constants.ts` (append) → satisfies N.P0.2
Add, verbatim from reference (keep the regexes here, never inline):
```ts
export const SMART_DIFF_ROLES = ['core', 'wiring', 'boilerplate'] as const;
export const SPLIT_TOO_BIG_LINES = 400;
export const SPLIT_TOO_BIG_FILES = 12;
export const BOILERPLATE_RE =
  /(package\.json|package-lock|pnpm-lock|yarn\.lock|tsconfig|\.lock$|\.snap$|\.md$|license|\.gitignore|dist\/|\.generated\.|migrations?\/)/;
export const WIRING_RE =
  /(index\.(ts|js)|routes?\.|config\.|\.module\.|setup\.|wiring|register|barrel|exports?\.)/;
```

### S2 — `server/src/modules/reviews/helpers.ts` (append) → satisfies C
```ts
import { BOILERPLATE_RE, WIRING_RE } from './constants.js';
export function classifyFile(path: string): 'core' | 'wiring' | 'boilerplate' {
  const p = path.toLowerCase();                 // case-insensitive
  if (BOILERPLATE_RE.test(p)) return 'boilerplate';  // precedence: boilerplate > wiring > core
  if (WIRING_RE.test(p)) return 'wiring';
  return 'core';
}
```

### S3 — `server/src/modules/reviews/smart-diff.ts` (new) → satisfies R
Pure composition; signature `smartDiff(container, repo, workspaceId, prId): Promise<SmartDiff>`:
1. `pull = repo.getPull(ws,prId)` → 404 if absent (R.P1.2).
2. `files = repo.getPrFiles(prId)`.
3. **finding_lines**: `for ({findings} of repo.reviewsForPull(prId))` → per file, expand
   `startLine..endLine` into a `Set<number>`; output sorted+deduped array (R.P0.2). No
   reviews → all empty (R.P0.3).
4. **classify** each file via `classifyFile`; `total_lines += add+del`.
5. **Optional T3 rank demote** (best-effort, R.P1.3): `try { getFileRank } catch {}`; a
   `core` file with percentile `<80` → `wiring`. If `getFileRank` absent on
   `container.repoIntel`, skip entirely (feature-detect) — never throw.
6. **groups**: emit only non-empty roles in `SMART_DIFF_ROLES` order (core→wiring→boilerplate) (R.P0.1).
7. **split_suggestion**: `too_big = total_lines>SPLIT_TOO_BIG_LINES || files.length>SPLIT_TOO_BIG_FILES`;
   `proposed_splits` = per non-empty role `{name:'<role> changes', files:[…]}` when too_big, else `[]` (R.P1.1).
8. **NO `container.llm*` reference anywhere** — the free-feature guarantee (R.P0.4).

### S4 — route + service wiring
- `reviews/service.ts`: `async smartDiff(ws, prId) { return smartDiff(this.container, this.repo, ws, prId); }`.
- `reviews/routes.ts`: `app.get<{Params:{id:string}}>('/pulls/:id/smart-diff', async (req) => { const {workspaceId} = await getContext(container, req); return service.smartDiff(workspaceId, req.params.id); });`
  (mirrors the existing `/pulls/:id/runs` route pattern).

### Server tests
- `reviews/helpers.test.ts` — **C.P0.1–C.P1.2** (hermetic, no Docker).
- `test/smart-diff.it.test.ts` — **R.P0.1–R.P1.3** (testcontainers): seed repo+PR+prFiles+a review;
  `buildApp({overrides:{llm:{openrouter:new MockLLMProvider('openrouter',{structured:{}})}}})`;
  `app.inject('GET /pulls/:id/smart-diff')`; assert body **and `llm.calls.length===0`** (R.P0.4).

---

## 3. Client implementation

### C1 — `useSmartDiff` hook (`client/src/lib/hooks/reviews.ts`) → I.P1.1
```ts
export function useSmartDiff(prId: string | null | undefined) {
  return useQuery({ queryKey:['pull',prId,'smart-diff'],
    queryFn:()=>api.get<SmartDiff>(`/pulls/${prId}/smart-diff`), enabled: !!prId });
}
```

### C2 — port `SmartDiffViewer/*` → V.P0.1/2, V.P1.1/2
Port `constants.ts` (`ROLE_META`: core=Boxes/accent, wiring=Workflow/warn, boilerplate=FileText/muted),
`helpers.ts` (`indexByPath`, `resolveGroupFiles`, `totalFindingLines`), `styles.ts`, and the
component. Behavior to preserve exactly:
- group order = `smartDiff.groups` (already core→wiring→boilerplate from server) → **core on top**;
- `GroupSection defaultOpen={i===0}` → **only first (core) open; wiring+boilerplate collapsed** (V.P0.2 / acceptance);
- keyboard-toggle (Enter/Space);
- split-nudge banner when `too_big` (V.P1.1);
- i18n `smartDiff.*` already present on-branch — no new keys needed.

### C3 — ENHANCEMENT: clickable "N findings" badge → diff line  → V.P0.3 (acceptance)
The reference shows a non-interactive per-file flag `⚑ N`. Acceptance demands a
**clickable** per-file badge that **jumps to the diff line**. Minimal, testable design:
1. **Anchor**: in `diff-viewer/CodeLine`, add a stable DOM id on added/context new-lines,
   e.g. `id={`dl-${filePath}-${newLine}`}` (thread the file path down from `FileCard`).
2. **Scroll helper** (`SmartDiffViewer/helpers.ts`): `scrollToDiffLine(path, line)` →
   `document.getElementById(`dl-${path}-${line}`)?.scrollIntoView({block:'center'})` + brief
   highlight class.
3. **Badge**: render per file with `finding_lines.length>0` as a `<button>` (aria-label
   `"{n} findings — jump to line"`); `onClick` → `scrollToDiffLine(path, finding_lines[0])`.
   Ensure the target group is expanded first (open it if collapsed).
> Rationale: finding `start/end` line numbers are diff **new-line** numbers, so anchoring
> by new-line aligns the badge to the exact changed line. Additive to DiffViewer — no
> behavior change for existing callers.

### C4 — DiffTab integration: Smart/Original toggle → I.P0.1/2 (mockup header)
In `DiffTab.tsx`:
- `const { data: smartDiff } = useSmartDiff(prId);`
- local `const [order,setOrder] = useState<'smart'|'original'>('smart')` (**Smart default**);
- header segmented control **"Smart order | Original order"** (mirror FindingsPanel's group-tabs pattern);
- `order==='smart' && smartDiff ? <SmartDiffViewer smartDiff={smartDiff} files={files} commenting={commenting}/> : <DiffViewer files={files} commenting={commenting}/>`.
- Keep `filesCount`/`canComment` props unchanged (backward-compatible).

### Client tests
- `SmartDiffViewer.test.tsx` — **V.P0.1–V.P1.2** (mock `DiffViewer` via `data-testid`; wrap in `NextIntlClientProvider` w/ `prReview.json`). Extend the reference smoke test with the collapse-default and clickable-badge assertions.
- `DiffTab.test.tsx` — **I.P0.1–I.P0.2** (mock `useSmartDiff`; assert default renders SmartDiffViewer, toggle swaps to DiffViewer).

---

## 4. `verify:l03` + gates (D5) → N.P0.3
Add to root `package.json`:
```json
"verify:l03": "pnpm -C server typecheck && pnpm -C client typecheck && pnpm -C server exec vitest run reviews/helpers smart-diff && pnpm -C client exec vitest run SmartDiffViewer DiffTab"
```
Must exit 0. (Integration `smart-diff.it` self-skips without Docker — verify runs the classifier + component tests deterministically; run the full `it` suite separately with Docker up.)

## 5. Contract lock-step (N.P0.1)
`brief.ts` `SmartDiff` already exists in both `vendor/shared` copies — **diff them** to
confirm byte-identical schema; add a tiny test that both `.parse()` the same fixture. No edits expected.

---

## 6. Validation matrix — plan step → deliverable → TDD IDs
| Step | Deliverable | Makes pass |
|---|---|---|
| S1 constants | D1 (thresholds in constants) | N.P0.2 |
| S2 classifyFile | D1 classification | C.P0.1, C.P0.2, C.P0.3, C.P1.1, C.P1.2 |
| S3 smart-diff.ts | D2 composition | R.P0.1, R.P0.2, R.P0.3, R.P0.4, R.P1.1, R.P1.3 |
| S4 route/service | D2 route | R.P1.2 (+ serves all R) |
| C1 useSmartDiff | D4 | I.P1.1 |
| C2 viewer port | D3 groups/collapse/nudge | V.P0.1, V.P0.2, V.P1.1, V.P1.2 |
| C3 clickable badge | D3 click→line | V.P0.3 |
| C4 DiffTab toggle | D4 | I.P0.1, I.P0.2 |
| verify:l03 | D5 | N.P0.3 |
| lock-step check | contract | N.P0.1 |
Every acceptance criterion (01-doc §1.5) → ≥1 step above. **No deliverable unmapped.**

## 7. Execution checklist (actionable, gate after each phase)
1. `git checkout -b feature/hw4-smart-diff` off `main` (or current HW base).
2. **Phase A (server):** S1→S4 + `reviews/helpers.test.ts` + `smart-diff.it.test.ts`.
   Gate: `pnpm -C server typecheck` = 0, C tests green, R tests green (Docker up).
3. **Phase B (client):** C1→C4 + `SmartDiffViewer.test.tsx` + `DiffTab.test.tsx`.
   Gate: `pnpm -C client typecheck` = 0, V+I tests green.
4. **Phase C:** add `verify:l03`; run it → green (N.P0.3). Run full suites (client+server+reviewer-core).
5. **Phase D (demo):** seed a **mega-PR** (lock-file + ≥2 core + wiring + >400 lines) so
   `too_big` triggers; Run Review to populate findings; verify lock collapsed + core on
   top + badges appear + click jumps; **check run logs show 0 new LLM calls**.
6. **Phase E:** open PR with compact description (reuse HW-2 PR-body style); write the
   **3-line finding-quality note** for the HW submission.

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| DiffViewer has no line anchors (click→line) | C3: add minimal `id` on CodeLine new-lines + `scrollToDiffLine`; test asserts the onClick target/scroll call |
| finding line-number vs diff new-line mismatch | anchor by **new-line** number; findings `start/end` are new-line numbers → aligned; V.P0.3 pins it |
| `getFileRank` absent on `repoIntel` | feature-detect + `try/catch` → heuristic; R.P1.3 marked optional |
| testcontainers flake (known env issue) | R (`*.it`) self-skips w/o Docker; C/V/I always run; `verify:l03` excludes `it` |
| mega-PR not "too_big" | seed >400 changed lines or >12 files; assert `too_big` before recording |
| accidental LLM coupling | R.P0.4 asserts `MockLLMProvider.calls.length===0` — CI catches any regression |

## 9. Out of scope / deferred (with reason)
- **`pseudocode_summary`** — contract allows `null`; populating it needs an LLM call →
  would violate the free-feature guarantee. Leave `null`.
- **T3 import-rank demotion** — implement as best-effort; if `getFileRank` unavailable,
  ship pure-heuristic classification (still meets all acceptance criteria).
- **Persisting SmartDiff** — recompute per request (cheap, always fresh); no cache/table.

---
*Definition of done:* all P0 tests green · typecheck 0 (client/server/reviewer-core) ·
`pnpm verify:l03` exit 0 · every acceptance criterion demonstrably met on the mega-PR ·
run logs show zero new LLM calls · PR open with description + 3-line note.
