# HW-2 — Implementation Plan (cross-verified against the TDD)

Each step names the **file(s)**, the **action**, the **reuse anchor** (from doc 01 §3), and the **test IDs** (doc 02) it satisfies. Order is dependency-correct. §7 is the cross-verification matrix: every test ID ⟵ the step that produces it.

Conventions honored throughout (from `CLAUDE.md`): ESM `.js` imports; register modules in `server/src/modules/index.ts`; edit **both** vendored `shared/` copies in lock-step; DB changes via `pnpm db:generate` → `db:migrate` (never hand-write SQL); tests + typecheck before "done".

---

## Phase 0 — Port the L2 Skills infrastructure (the "lab") onto `main`

Goal: bring the DB-backed Skills feature so HW-2 can create/attach/inject/import skills. Do this **on `main`** (or a short `lab/skills` branch merged to `main`), then branch HW-2 work off it — keeping the HW-2 PR focused.

**0.1 Bring the new skills files** (they don't exist on `main`, so a selective checkout is conflict-free):
```
git checkout origin/lesson-2-lab/skills -- \
  server/src/modules/skills/ \
  client/src/app/skills/ \
  client/src/app/agents/'[id]'/_components/AgentEditor/_components/SkillsTab/ \
  client/src/lib/hooks/skills.ts
```
(Adjust client globbing to the actual dirs found by `git ls-tree -r origin/lesson-2-lab/skills | grep -E 'app/skills|SkillsTab|hooks/skills'`.)

**0.2 Apply the wiring edits by hand** (these touch existing files → do surgically, do NOT take the lab's whole-file versions which also carry run-cost):
- `server/src/modules/index.ts` — register the `skills` plugin.
- `server/src/platform/container.ts` — add `skillsRepo` (and `skillsService` if used).
- `server/src/modules/reviews/run-executor.ts` — insert the injection block (`linkedSkills` → filter `enabled` → pass `skills` to `reviewPullRequest`) at the pre-review assembly point (`~:187-216`). **Reuse:** the 15-line lab hunk.
- `server/src/vendor/shared/contracts/knowledge.ts` **+** `client/src/vendor/shared/contracts/knowledge.ts` — add `SkillVersion`, `SkillStats`, `SkillImportPreview` (lock-step).
- `server/src/vendor/shared/contracts/trace.ts` **+** client copy — confirm `prompt_assembly.skills` exists (already on `main`; no-op if present).
- `client/src/vendor/ui/nav.ts` — add the "SKILLS LAB" nav section.
- `server/package.json` — add `fflate` (zip import dep).

**0.3 Schema + migration:** add `skill_versions.message` to `server/src/db/schema/skills.ts`; run `cd server && pnpm db:generate` (produces a fresh `00NN_*.sql` — do NOT reuse the lab's `0011`) then `pnpm db:migrate`.

**0.4 Seed (optional):** port the `skillCatalog` block into `server/src/db/seed.ts` for demo built-ins (idempotent insert into `t.skills` + `t.skillVersions`).

**0.5 Tests:** add `server/test/skills.it.test.ts` (mirror `reference`). ⟶ **T0.1, T0.2, T0.3**.
**0.6 Gate:** `pnpm typecheck` (client+server) + full suites green. ⟶ **T0.4**. Boot app, smoke `/skills`.

---

## Phase A — Conventions Extractor (server)

Branch: `feature/hw2-conventions-extractor` (off the Phase-0 `main`).

**A.1 Port the reference module STRUCTURE, replace the pipeline** — take `conventions/{constants,helpers,repository,routes,service}.ts` shape from `origin/reference/full-build` (selective checkout), but **swap the 2-step-LLM `extract-pipeline.ts` for a deterministic code-only selector** (doc 01 §4 rev):
- `conventions/sampling.ts` (new) — `collectConventionSamples(container, repoId)`: `getConventionSamples(12)` **+ config files** (`.eslintrc*`, `tsconfig.json`, `.prettierrc*`) via a `readClone` list; return `{path, content}[]` under a byte budget.
- `conventions/extract.ts` — one `completeStructured<ConventionsExtraction>` call (model from `resolveFeatureModel('conventions')`), **file bodies fenced with `wrapUntrusted`**, schema `{category?, rule, evidence_path, evidence_snippet, confidence}`, temp 0, retries.
- keep `helpers.ts:groundEvidence` (drop bad path / cap ungrounded at 0.5) and add `deriveEvidenceLine` (A.2).
Register in `modules/index.ts`; DI in `container.ts` if needed. **Reuse:** reference module skeleton + grounding; `completeStructured`; `wrapUntrusted`. ⟶ **TA.4, TA.5, TA.6, TA.7, TA.11**.

**A.2 Evidence line (`evidence_line`)** — DB delta + helper:
- `server/src/db/schema/knowledge.ts` — add `evidenceLine: integer('evidence_line')` (nullable) to the `conventions` table; `pnpm db:generate` → `db:migrate`.
- add `deriveEvidenceLine(fileContent, snippet): number | null` in `conventions/helpers.ts` (find the snippet's first-line index, whitespace-tolerant). Call it inside `groundEvidence` and persist `evidence_line`.
- add `evidence_line` to `ConventionCandidate` in **both** vendored `contracts/knowledge.ts`.
**Reuse:** `helpers.ts:groundEvidence`. ⟶ **TA.2** (+ feeds TA.13).

**A.3 Reject** — HW delta:
- `conventions/repository.ts` — add `markRejected(ws, id)` (either a `rejected boolean` column via `db:generate`, or set `accepted:false` + a `dismissed` flag; prefer an explicit `rejected` boolean for clarity → schema delta + migration).
- `conventions/routes.ts` — `POST /conventions/:id/reject` → `service.reject`.
- exclude rejected from the merge (Phase A.4) and from re-extract survival.
**Reuse:** reference accept path (mirror it). ⟶ **TA.8**.

**A.3b Edit candidate** — HW capability #4 (functional spec, was mis-flagged optional):
- `conventions/repository.ts` — `updateCandidate(ws, id, {rule?, evidenceSnippet?})`.
- `conventions/routes.ts` — `PUT /conventions/:id` → `service.edit`; when `evidenceSnippet` changes, re-run `groundEvidence` + `deriveEvidenceLine` so confidence/line stay honest.
- client hook `useEditConvention`. ⟶ **TA.15**.

**A.4 Create-skill-from-accepted (merge)** — HW delta (replaces the reference's per-candidate accept-creates-skill):
- add `mergeConventionsSkillBody(name, repo, accepted[]): string` in `helpers.ts` producing the **exact mockup format** (doc 04): `# <name>` + the `House conventions for \`<repo>\`. Flag changes…cite the offending \`file:line\`.` intro + one `## <rule-slug>` section per accepted candidate (`<rule text>` + `Detected in \`path:lines\`:` + fenced snippet); deterministic order (confidence desc, path); rejected/unaccepted absent. ⟶ **TA.3**.
- `conventions/routes.ts` — `POST /repos/:id/conventions/skill` (body: optional `{name, description, type, body}`; default name `repo-conventions`, type `convention`, body = merge of **accepted** candidates) → `service.createSkill`.
- `conventions/service.ts` — `createSkill` = gather accepted → `mergeConventionsSkillBody` → `skillsService.create({ name, description, type:'convention', source:'extracted', body, enabled:true, evidenceFiles })` → return `{ skill_id }`. **Reuse:** `SkillsService.create` (Phase 0). ⟶ **TA.9**.
- keep the reference per-candidate `POST /conventions/:id/accept` as the "mark accepted" step (no longer creates a skill); the skill is created by the merge endpoint.

**A.5 Agent-link convenience** — the merge endpoint's returned `skill_id` is linked via the existing `POST /agents/:id/skills {skill_ids}` (no new server code; the client wires the button). **Reuse:** `agents/routes.ts:153`. ⟶ **TA.10** (asserts link + injection).

**A.6 Server unit + integration tests** — `conventions/helpers.test.ts` (TA.1–TA.3) + extend `server/test/conventions.it.test.ts` (TA.5–TA.11) using `MockLLMProvider.structuredBySchema`. ⟶ **TA.1, TA.2, TA.3, TA.5–TA.11**.

---

## Phase A′ — Conventions Extractor (client)

**A′.1 Port the reference conventions page** — `client/src/app/repos/[repoId]/conventions/` (`page.tsx`, `_components/ConventionsView`, `_components/ConventionCard`) + `client/src/lib/hooks/conventions.ts` (`useConventions`, `useExtractConventions`, `useAcceptConvention`). ⟶ base for **TA.12, TA.14**.

**A′.2 Clickable GitHub evidence** — HW delta: in `ConventionCard`, render the evidence path as an anchor `href = githubBlobUrl(repoFullName, headSha, evidence_path, evidence_line, evidence_line)` (need repo `full_name` + a ref — use the repo default branch head; pass from the page via the repo query). **Reuse:** `githubBlobUrl` (`lib/github-urls.ts:24`, from HW-1). ⟶ **TA.13**.

**A′.3 Reject + edit + selection** — add **Reject** and inline **Edit** (rule text) actions to `ConventionCard`; track accepted vs rejected; hooks `useRejectConvention`, `useEditConvention`, `useCreateConventionSkill`. ⟶ **TA.12, TA.15**.

**A′.4 "Create skill from accepted" modal** (design = doc 04 View 2) — reuse the lab `SkillEditor` `ConfigTab` fields (Name/Description/Type/Enabled/body markdown), prefilled from the merge ("Merged from N accepted…"), with the `<name>.md` header, `unsaved` badge, and a **token count** (server tokenizer/client estimate). On **Create skill** → `POST /repos/:id/conventions/skill` → then a **"Link to agent"** select → `POST /agents/:id/skills`. Also add the list toolbar: **Deselect all** + `N of M accepted` counter (Create-skill disabled at 0). **Reuse:** lab SkillEditor form, `ProgressBar`, existing modal shell. ⟶ **TA.14**.

**A′.5 Component tests** — `ConventionCard.test.tsx` (TA.12, TA.13), `ConventionsView.test.tsx` (TA.14). ⟶ **TA.12, TA.13, TA.14**.

---

## Phase B — API Contract Reviewer + 4 skills

**B.1 Author the 4 skills** — bodies in the seed-catalog format (`# Title / ## Rule (CRITICAL|WARNING) / ## Good / ## Bad`):
- `breaking-change` (type `rubric`) — removing/renaming a public route, param, or response field.
- `response-schema` (type `convention`) — response shape changes (types, field requiredness).
- `semver-discipline` (type `convention`) — changes that require a major bump.
- `deprecation-policy` (type `convention`) — mark `@deprecated` + sunset instead of silent removal.
Add them to `server/src/db/seed.ts` `skillCatalog` **and** keep the markdown for runtime `POST /skills` / import. Add a small content check. **Reuse:** seed template (`no-then-chains`, `seed.ts:257`). ⟶ **TB.1**.

**B.2 Seed/author the agent** — `API_CONTRACT_REVIEWER_PROMPT` in `server/src/db/seed-prompts.ts`; a seed entry in `db/seed.ts:agents` (mirror "Test Quality Reviewer", `seed.ts:445`) that links 3 skills, leaving the 4th to import live. Also creatable at runtime via `POST /agents`. ⟶ **TB.2**.

**B.3 Link (incl. import)** — link via `POST /agents/:id/skills {skill_ids}`; import ≥1 skill through the ImportDrawer (`POST /skills/import` → `POST /skills {enabled:false}` → enable → link). **Reuse:** `ImportDrawer.tsx`, `agents/routes.ts:153`. ⟶ **TB.3, TB.4**.

**B.4 Without/with experiment test** — `server/test/agents-contract-reviewer.it.test.ts`: same agent + fixed breaking-change diff, run with `skill_ids:[]` vs 4 linked; assert `prompt_assembly.skills` null vs non-null-containing-`breaking-change`. **Reuse:** T0.3 injection mechanism. ⟶ **TB.5**.

**B.5 Manual live experiment** — real PR (rename a response field / change a route sig), run without then with skills; capture both traces for the video. ⟶ **M-B.1**.

---

## Phase C — Package & submit

**C.1** PR off the HW-2 branch → `tsanm/dev-digest:main` with a compact, mapped description (What & why · Changes table · Extractor **finding-quality report** · without/with experiment table · Acceptance checklist · How-to-verify). **Reuse:** HW-1 PR shape.
**C.2** Demo video: Extractor (scan → accept/reject → evidence click → create skill → link) + contract-reviewer without/with. Attach as a true GitHub attachment (drag-drop).
**C.3** Final gate: all suites + typecheck green; CI green; manual checklist (doc 02 §5) reproduced. ⟶ acceptance #7, #8.

---

## Phase 5 — Stretch (optional; only if time)

**5.1** URL import (reference ImportDrawer `UrlPanel`) → **TS.1**. **5.2** Package a skill as a Claude Code plugin: `plugin.json` (`version:"1.0.0"`) + `marketplace.json` + `.claude/skills/<name>/SKILL.md` + `skills-lock.json` entry → **TS.2**. **5.3** Run Extractor on your own repo → **TS.3**. **5.4** Improve finding quality by feeding more repo-intel data (e.g. include config files in `getConventionSamples`).

---

## 6. Build order (critical path)

`0.1→0.2→0.3` (skills infra) → `0.5` (skills tests) → **[A.1→A.2→A.3→A.4] ∥ [B.1]** → `A.6` → `A′.1→A′.2→A′.3→A′.4→A′.5` → `B.2→B.3→B.4` → `B.5/M-B.1` (live) → `C`. Phase A server and B.1 skill-authoring are independent and can proceed in parallel once Phase 0 lands.

---

## 7. Cross-verification: every doc-02 test ID is produced by a step (TDD ⇔ plan)

Grouped by producing step; IDs are the prioritized doc-02 catalog. This mapping is authoritative.

| Step | Produces (doc-02 test IDs) |
|---|---|
| **0.2** run-executor injection wiring | (mechanism for) A8.P0.1, B5.P0.1/2 |
| **0.5** skills.it.test | S1.P0.1, S1.P1.1, B4.P0.1, B4.P0.2, B4.P1.2, N1.P0.2 |
| **0.6** port regression gate | (all existing suites green) |
| **A.1 + A.1(sampling/extract)** | A1.P0.1, A1.P0.2, A1.P1.1, A1.P1.2, A1.P1.3, A2.P0.1, A5.P0.1, A5.P0.2, A5.P1.2, N1.P0.1, N3.P0.1, N4.P0.1, N5.P0.1 |
| **A.2 evidence_line** | A5.P1.1 (+ feeds A6.P0.1) |
| **A.3 reject** | A3.P0.1 |
| **A.3b edit** | A4.P0.1, A4.P1.1 |
| **A.4 merge + create-skill route** | A7.P0.1, A7.P0.2, A7.P1.1, A7.P1.3 |
| **A.5 agent-link** | A8.P0.1, A8.P1.1 |
| **A.6 server unit+it tests** | (executes all A*/N* server assertions above) + N6.P0.1, N9.P0.1 |
| **A′.1 conventions page** | A2.P0.2, A2.P1.1, A2.P1.2 |
| **A′.2 GitHub evidence** | A6.P0.1, A6.P1.1, A6.P1.2 |
| **A′.3 reject/edit/select** | A3.P0.2, A3.P1.1, A3.P1.2, A4.P1.2 |
| **A′.4 create-skill modal** | A7.P0.3, A7.P1.2, A8.P1.2 |
| **A′.5 component tests** | (executes A*/N8 client assertions) + N8.P0.1 |
| **B.1 author 4 skills** | B2.P0.1, B2.P1.1 |
| **B.2 seed/create agent** | B1.P0.1, B1.P1.1 |
| **B.3 link (+import UI)** | B3.P0.1, B3.P1.1, B4.P1.1 |
| **B.4 without/with test** | B5.P0.1, B5.P0.2, B5.P1.1 |
| **B.5 live experiment** | B5.M.1 |
| **C.3 final gate** | N7.P0.1, N10.P0.1 |
| **C.2 demo** | M-A.1..6, M-B.1, M-video |
| **5.* stretch** | TS.1..3 |

**Completeness check:** every FR (A1–A8, B1–B5, S1) and every NFR (N1–N10) test ID in doc 02 appears above with a producing step; every HW acceptance line (doc 02 §3) is covered by ≥1 **P0** automated test and/or a manual demo step. ⇒ executing this plan satisfies the prioritized test & verification plan. A step whose P0 tests fail blocks its phase (DoD gate, doc 02 §0).
