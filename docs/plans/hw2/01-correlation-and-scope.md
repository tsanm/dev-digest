# HW-2 — Correlation Map & Scope Decisions

_Conventions Extractor + API Contract Reviewer agent (with Skills)._
Branch: `feature/hw2-conventions-extractor` (off `main`). Sources: `goit-agentic-hw2.pdf`, `goit-agentic-lab2.pdf`, and a 4-way repo investigation across `main` / `lesson-2-lab/skills` / `reference/full-build`.

---

## 1. What HW-2 asks for (from the PDF)

**Part A — Conventions Extractor** (graded feature): analyze a repo's code-style conventions → produce candidates `{rule, evidence(file+line), confidence}` → **verify evidence in real code** → UI list with **accept / reject / edit** → **merge accepted → one `repo-conventions` skill** (editable name/desc/type/body modal) → **link the skill to an agent** and run it on review. Evidence must be **clickable → the file on GitHub**.

**Part B — API Contract Reviewer** (graded agent): create a reviewer agent via UI/API with **4 skills** — `breaking-change`, `response-schema`, `semver-discipline`, `deprecation-policy` (each directive + good/bad example). Attach the skills (**≥1 via import**). Experiment: run a PR that changes a route signature / renames a response field **without skills (misses)** vs **with skills (catches the breaking change + comments)**.

**Acceptance (must all hold):** demo video (Extractor in action + contract-reviewer without/with skills) · open PR w/ good description + short report on Extractor finding quality · Extractor shows results on the UI · accepted candidates → a skill, **rejected excluded** · **evidence clickable → real GitHub code** · generated skill **linkable to an agent + runs on review** · contract reviewer **with skills catches a breaking change missed without**.

**Stretch:** import a skill from URL · package a skill as a Claude Code plugin (`plugin.json` v1.0.0 + `marketplace.json` in a git repo) · run Extractor on your own repo · improve finding quality (add repo-intel data).

---

## 2. The dependency: HW-2 sits on the L2 "Skills" lab

HW-2 explicitly reuses "the mechanism from the lab" — the **Skills infrastructure** the Lab-2 video builds: markdown rule-blocks (name/type/description/body) stored in DB, attached+ordered per agent, **injected into the review prompt**, shown as a **skills block in the run trace**; **import** from file/archive with preview (untrusted). That infra is **NOT on `main`** yet. So the plan has a prerequisite phase (port the lab), then the two HW features.

### 2a. Skills infra — what's already on `main` vs added by the lab

| Piece | On `main`? | Added by `lesson-2-lab/skills` |
|---|---|---|
| `skills` / `skill_versions` / `agent_skills` tables (`0000_init`) | ✅ | — |
| Agent↔skill links: `linkedSkills` (order asc), `setSkills`, `GET/POST /agents/:id/skills` | ✅ | — |
| reviewer-core prompt slot: `## Skills / rules` + `prompt_assembly.skills` field | ✅ | — |
| `Skill` / `AgentSkillLink` contracts | ✅ | + `SkillVersion`/`SkillStats`/`SkillImportPreview` |
| **Server skills module** `modules/skills/{routes,service,repository,helpers}.ts` (CRUD, versions, stats, **import**) | ❌ | ✅ |
| **run-executor injection** (fetch linked+enabled skills → feed engine) `run-executor.ts:187-190` | ❌ | ✅ |
| Client Skills UI (page, editor, **ImportDrawer**) + agent **SkillsTab** + nav | ❌ | ✅ |
| Seed skill catalog + a demo agent with linked skills | ❌ | ✅ |
| `skill_versions.message` column (migration `0011`) | ❌ | ✅ |

Run-time behavior we depend on (verified): `run-executor.ts:189` filters `l.skill.enabled` and passes ordered `skills[]` to the engine; `reviewer-core/prompt.ts:88-131` joins them into one `## Skills / rules` section and records `prompt_assembly.skills`; the client renders that as a distinct **PromptBlock** in the RunTraceDrawer (`TraceBody.tsx:73-75`) — **absent when zero enabled skills**. This is exactly the "skills block in the trace / disabled = not shown" acceptance from the lab.

### 2b. Conventions Extractor — what's already on `main` vs must build

| Piece | On `main`? | Notes |
|---|---|---|
| `conventions` table (`0000_init`): `repo_id, rule, evidence_path, evidence_snippet, confidence, accepted` | ✅ | **No** `category`, **no** `evidence_line`, single `accepted` boolean |
| `ConventionCandidate` contract (both vendored copies) | ✅ | id, rule, evidence_path, evidence_snippet, confidence, accepted |
| `conventions` feature-model (`resolveFeatureModel('conventions')`, default `openai/gpt-5.4`) | ✅ | ready to call |
| `repoIntel.getConventionSamples(repoId, n)` (top files by import-rank, drops junk) | ✅ | built, **unused** — ready to consume |
| `messages/en/conventions.json` (i18n strings) | ✅ | pre-shipped |
| **Server module** `modules/conventions/{routes,service,extract-pipeline,repository,helpers,constants}.ts` | ❌ | on `reference` — portable |
| **Client** conventions page + hooks | ❌ | on `reference` — portable |

### 2c. The reference Extractor is SIMPLER than the HW acceptance criteria

`reference/full-build`'s Extractor: `GET /repos/:id/conventions`, `POST /repos/:id/conventions/extract`, `POST /conventions/:id/accept`. Accept creates **one `type:'convention'` skill per candidate**; **no reject, no edit, no merged `repo-conventions` skill, no agent-link, plain (non-clickable) evidence.**

**So the HW requires a delta on top of the reference:**

| HW acceptance needs | Reference has | ⇒ HW delta to build |
|---|---|---|
| accept **and reject** (rejected excluded) | `accepted` boolean only | add a rejected state / selection |
| merge accepted → **one** `repo-conventions` skill (editable modal) | one skill per candidate | merge + "create skill from conventions" flow |
| evidence **clickable → GitHub blob** | plain `MonoLink` | reuse `githubBlobUrl` (from HW-1) |
| generated skill **linked to an agent** | accept never links | call the existing `setSkills`/link path |

The **hard engine** — 2-step LLM file-selection + **evidence grounding** (drop hallucinated paths, cap ungrounded confidence at 0.5) — is fully reusable from the reference (`extract-pipeline.ts`, `helpers.ts:groundEvidence`).

---

## 3. Reuse map (build on these — do NOT reinvent)

| HW-2 need | Reuse | Location |
|---|---|---|
| Cheap structured LLM call | `container.llm(p).completeStructured({ model, schema, schemaName, messages, maxRetries })` → `{data,tokensIn,tokensOut,costUsd,raw}` | `adapters.ts:86`; pattern `reviewer-core/review/run.ts:174` |
| Model selection for `conventions` | `resolveFeatureModel(container, ws, 'conventions')` (already registered) | `settings/feature-models.ts:51`; `contracts/platform.ts:72` |
| Zod→JSON-schema + parse/repair | `toJsonSchema`, `parseWithRepair` | `reviewer-core/src/llm/structured.ts:19,54` |
| Config + top-file selection | `repoIntel.getConventionSamples()` / `getTopFilesByRank()` | `repo-intel/service.ts:630,639` |
| Extract pipeline + evidence grounding | port `extract-pipeline.ts` + `helpers.ts:groundEvidence` | `reference:server/src/modules/conventions/` |
| Skill CRUD + create-from-conventions | `SkillsService.create(...)` | `skills/service.ts` (lab) |
| Attach skill to agent (ordered) | `POST /agents/:id/skills {skill_ids}` → `setSkills` | `agents/routes.ts:153`, `repository.ts:setSkills` |
| Skills injected into review prompt | `run-executor.ts:187-190` → engine `skills[]` → `## Skills / rules` | (lab wiring) |
| Skills block in trace | `prompt_assembly.skills` → `TraceBody.tsx:73-75` | (lab) |
| Clickable GitHub evidence | `githubBlobUrl(repoFullName, headSha, file, start_line, end_line)` | `client/src/lib/github-urls.ts:24` |
| New reviewer agent + prompt | `POST /agents` + a `*_REVIEWER_PROMPT` const; seed analog "Test Quality Reviewer" | `agents/routes.ts:33`, `db/seed.ts:445`, `seed-prompts.ts` |
| Skill import (md/zip, preview, untrusted) | `POST /skills/import` → preview → `POST /skills {enabled:false}` | `skills/service.ts:132`, `ImportDrawer.tsx` |
| Test doubles | `MockLLMProvider.structuredBySchema[schemaName]`, `MockGitClient({files})`, `MockCodeIndex()` | `adapters/mocks.ts:58` |
| Integration test harness | `startPg()` + `buildApp({db,overrides})` + `app.inject`, docker-gated `describe.skip` | `test/helpers/pg.ts`; templates `settings-models.it.test.ts`, `reference:conventions.it.test.ts`, `reference:skills.it.test.ts` |

**Dead code to ignore:** `server/src/platform/model-router.ts` (zero call sites).

---

## 4. Scope decisions (defaults chosen; flagged for review)

1. **Base strategy — port the L2 Skills infra onto `main` first (the "lab"), then build HW-2 features on a branch off it.** Mirrors HW-1 (lab foundation on `main`, feature PR separate) and keeps the HW-2 PR a focused, gradeable diff. *Porting method:* selective file-checkout of the new skills files from `lesson-2-lab/skills` + a small enumerated set of wiring edits + regenerate the migration (avoids dragging in the branch's unrelated L1 run-cost changes and its course-CLAUDE.md). See impl plan Phase 0. **Alternative:** branch HW-2 directly off `lesson-2-lab/skills` (simplest, but loses our L1 foundation & bundles run-cost). → _default: port to `main`._

2. **Conventions Extractor scope — build the full "Як юзер я можу" capability list** (run · see all · accept/**reject** · **edit a candidate** · open skill-modal from selected · edit skill text+metadata · save/discard) plus the acceptance extras (clickable GitHub evidence · agent-link), reusing the reference's extract+grounding engine. Candidate **edit** (`PUT /conventions/:id`) is REQUIRED per the functional spec (page 4), not optional. Only a **category** field stays optional (mockup-only, not in the spec or acceptance). → _default: full capability list in; category optional._

3. **Evidence line for the GitHub link** — the reference grounds on `evidence_snippet` (substring), no line number. To make evidence clickable to a specific GitHub line, **derive the line** = index of the grounded snippet's first line within the file, stored as `evidence_line`, used by `githubBlobUrl`. Grounding stays snippet-based (robust to reformatting). → _default: derive line at grounding time._

4. **Extract pipeline — deterministic, code-only selection (REVISED after step-review).** Do **not** port the reference's 2-step-LLM file-picker. Instead: sample = `getConventionSamples(12)` (top source files) **+ real config files** (`.eslintrc*`, `tsconfig.json`, `.prettierrc*`) read from the clone → **one** cheap-model call (`resolveFeatureModel('conventions')`), file bodies **fenced as untrusted** (`wrapUntrusted`), returning `{category?, rule, evidence_path, evidence_snippet, confidence}`. Cheaper (1 LLM call vs 2), deterministic/unit-testable, and config files are the highest-signal convention source (an eslint config *is* conventions) — this also delivers the HW's "improve quality by adding repo-intel data" stretch for free. Grounding = snippet substring (drop bad path; cap ungrounded confidence at 0.5) + derive `evidence_line`. → _default: code-only selection + config enrichment._

5. **API Contract Reviewer** — create the agent + 4 skills at **runtime via the UI/API** (not only seed) so the demo shows the real path; **seed** them too for reproducibility/tests. Author the 4 skills in the seed-catalog body format (`# Title / ## Rule (CRITICAL/WARNING) / ## Good / ## Bad`). Import ≥1 skill via the ImportDrawer to exercise the import path. → _default: runtime + seed._

6. **Skills-infra tests** — the lab shipped none; we add them (the acceptance leans on skill injection + trace block). Mirror `reference:skills.it.test.ts`. → _default: add._

---

## 5. Out of scope (explicitly)

Per-skill token breakdown in the trace (only run-level totals exist; the skills block is one section) · memory on accept/dismiss · parallel agent runs · internet skill search. The stretch items (URL import, plugin packaging, own-repo run, repo-intel enrichment) are planned as **optional Phase 5** — not required for acceptance.

---

## 6. Risk register

| Risk | Mitigation |
|---|---|
| Porting the lab conflicts on `CLAUDE.md`/run-cost | Selective file-checkout of *new* skills files + enumerated wiring hunks; keep our `CLAUDE.md`; skip run-cost |
| New DB column (`evidence_line`, migration for skills) drift | `pnpm db:generate` → `db:migrate` only; never hand-write SQL; keep both vendored `shared/` copies in lock-step |
| LLM extraction non-determinism breaks tests | Test the pure seams (grounding, merge, line-derivation) as unit tests; drive the pipeline with `MockLLMProvider.structuredBySchema` fixtures |
| "Breaking change caught only with skills" not reproducible | Fixed demo PR + deterministic prompt assembly; keep `repo_intel` constant across the A/B; assert on the persisted traces |
| Scope creep (mockup shows more than acceptance) | Gate on the acceptance-criteria checklist (doc 02); edit/category are optional |
