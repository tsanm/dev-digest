# HW-2 — Test & Verification Plan (TDD, prioritized)

Formal, priority-tagged test contract. Every **functional requirement (FR)** has **1–3 P0** + **2–3 P1** tests; every **non-functional requirement (NFR)** has **1–2 P0**. §3 proves coverage of the HW **Критерії приймання** and **Як перевірити**. Written test-first: a unit is "done" only when its P0s (and, for release, P1s) are green.

## 0. Conventions

- **Priority:** **P0** = blocking — core happy-path, correctness, security, or a direct acceptance criterion; **CI-gating**. **P1** = important edges/secondary flows; required for "done", non-gating for the first vertical slice.
- **Layer:** `U` server unit (`*.test.ts`, hermetic) · `I` server integration (`*.it.test.ts`, testcontainers Postgres, docker-gated) · `C` client component (`*.test.tsx`, jsdom) · `M` manual/demo (running app + live LLM) · `E` e2e (agent-browser, optional).
- **Test doubles:** `MockLLMProvider({ structuredBySchema: { <Schema>: <fixture> } })` (validates fixture vs the Zod schema, records `.calls`), `MockGitClient({ files })`, `MockCodeIndex()`; app under test via `buildApp({ db, overrides })` + `app.inject`.
- **ID scheme:** `<Req>.<Priority>.<n>` (e.g. `A5.P0.1`, `N1.P0.1`).
- **DoD gate:** all P0 + P1 green · `pnpm typecheck` 0 (client/server/reviewer-core) · CI lanes green · manual/demo checklist (§4) reproduced.

---

## 1. Functional requirements → tests

### FR-A1 — Run repository analysis (`POST /repos/:id/conventions/extract`)
| ID | P | L | Assertion |
|---|---|---|---|
| A1.P0.1 | P0 | I | With a `MockLLMProvider` fixture, extract → **200** and persists ≥1 candidate (`accepted:false`) retrievable via GET. |
| A1.P0.2 | P0 | I | Extract resolves the model via `resolveFeatureModel('conventions')` and issues exactly **one** structured call (assert `MockLLM.calls` schema = `Conventions*`). |
| A1.P1.1 | P1 | I | **Idempotent re-scan:** an accepted candidate survives a second extract; only `accepted=false` rows are replaced. |
| A1.P1.2 | P1 | I | Empty/degraded samples (repo-intel off, no files) → **200** with 0 candidates, no throw. |
| A1.P1.3 | P1 | U | `collectConventionSamples` returns top source files **+ config files** (`.eslintrc*`,`tsconfig.json`,`.prettierrc*`), within the byte budget. |

### FR-A2 — See all found conventions (list + UI)
| ID | P | L | Assertion |
|---|---|---|---|
| A2.P0.1 | P0 | I | `GET /repos/:id/conventions` returns each candidate with `rule, evidence_path, evidence_line, evidence_snippet, confidence, accepted`. |
| A2.P0.2 | P0 | C | `ConventionsView` renders one `ConventionCard` per candidate (rule + confidence bar + evidence). |
| A2.P1.1 | P1 | C | Empty state (pre-scan) shows the Re-scan CTA; loading → skeletons; extract error → error state. |
| A2.P1.2 | P1 | C | Header shows `Detected from <N> sample files · last scan <time>`; Re-scan triggers `useExtractConventions`. |

### FR-A3 — Accept / Reject a candidate
| ID | P | L | Assertion |
|---|---|---|---|
| A3.P0.1 | P0 | I | `POST /conventions/:id/accept` → `accepted:true`; `POST /conventions/:id/reject` → rejected state persisted. |
| A3.P0.2 | P0 | C | `ConventionCard` Accept/Reject call their handlers; accepted → accent/selected state. |
| A3.P1.1 | P1 | C | `Deselect all` clears the accepted set; the `N of M accepted` counter updates live. |
| A3.P1.2 | P1 | C | `Create skill` is disabled when 0 accepted, enabled otherwise. |

### FR-A4 — Edit a candidate
| ID | P | L | Assertion |
|---|---|---|---|
| A4.P0.1 | P0 | I | `PUT /conventions/:id {rule}` persists the edited rule. |
| A4.P1.1 | P1 | I | `PUT` with a changed `evidence_snippet` **re-grounds** (re-derives `evidence_line`, re-caps confidence if now ungrounded). |
| A4.P1.2 | P1 | C | Inline rule-edit on the card saves via `useEditConvention` and reflects the new text. |

### FR-A5 — Evidence grounding (anti-hallucination core)
| ID | P | L | Assertion |
|---|---|---|---|
| A5.P0.1 | P0 | U | `groundEvidence`: candidate whose `evidence_path` ∉ sampled files → **dropped** (null). |
| A5.P0.2 | P0 | U | Snippet found (whitespace-normalized substring) → kept, confidence unchanged; snippet **not** found → kept, confidence **capped ≤ 0.5**. |
| A5.P1.1 | P1 | U | `deriveEvidenceLine` returns the correct 1-based start line; snippet absent → `null`. |
| A5.P1.2 | P1 | I | Extract fixture with a hallucinated-path candidate ⇒ that candidate is **absent** from the persisted list. |

### FR-A6 — Clickable evidence → GitHub file
| ID | P | L | Assertion |
|---|---|---|---|
| A6.P0.1 | P0 | C | Evidence renders an anchor with `href === githubBlobUrl(repoFullName, headSha, path, line, line)`, opens in a new tab. |
| A6.P1.1 | P1 | C | The evidence copy-icon copies `path:lines`. |
| A6.P1.2 | P1 | C | `evidence_line == null` → link falls back to the file (no `#L` anchor), still valid. |

### FR-A7 — Create skill from accepted (merge → one `repo-conventions`)
| ID | P | L | Assertion |
|---|---|---|---|
| A7.P0.1 | P0 | U | `mergeConventionsSkillBody` emits the exact mockup format (`# <name>`, intro, one `## <slug>` per **accepted** candidate + `Detected in \`path:lines\`` + fenced snippet); **rejected/unaccepted absent**. |
| A7.P0.2 | P0 | I | `POST /repos/:id/conventions/skill` creates **one** skill (`type:'convention'`, `source:'extracted'`, body = merge of accepted only), returns `skill_id`; a rejected candidate's rule is **not** in the body. |
| A7.P0.3 | P0 | C | Create-skill modal is prefilled (Name/Description/Type/Enabled/body) with a **token count**; editable before save. |
| A7.P1.1 | P1 | I | Custom name/description/body sent in the request are persisted (not the defaults). |
| A7.P1.2 | P1 | C | Modal `Cancel` closes without creating; `Create skill` POSTs and shows `added to Skills Lab`. |
| A7.P1.3 | P1 | U | Token-count util returns a positive integer for a non-empty body. |

### FR-A8 — Link generated skill to agent + run on review
| ID | P | L | Assertion |
|---|---|---|---|
| A8.P0.1 | P0 | I | `POST /agents/:id/skills {skill_ids:[conventionSkillId]}` → `GET` returns the link; a subsequent review run's `prompt_assembly.skills` **contains the convention body**. |
| A8.P1.1 | P1 | I | Re-posting a smaller `skill_ids` set unlinks the skill → its body no longer in the prompt. |
| A8.P1.2 | P1 | C | Post-create "Link to agent" select posts `skill_ids` and confirms the link. |

### FR-B1 — Create the API Contract Reviewer agent
| ID | P | L | Assertion |
|---|---|---|---|
| B1.P0.1 | P0 | I | `POST /agents {name:'API Contract Reviewer', provider, model, system_prompt}` → **201** with id; `GET /agents` lists it. |
| B1.P1.1 | P1 | I | Seeding the agent is idempotent (re-run doesn't duplicate). |

### FR-B2 — Four API-contract skills authored
| ID | P | L | Assertion |
|---|---|---|---|
| B2.P0.1 | P0 | U | Each of `breaking-change`,`response-schema`,`semver-discipline`,`deprecation-policy` has a valid `type`, a non-empty body containing `## Good` + `## Bad` and ≥1 severity word (`CRITICAL`/`WARNING`). |
| B2.P1.1 | P1 | U | The catalog contains exactly those 4 slugs (no typos/dupes). |

### FR-B3 — Attach skills to an agent (≥1 via import)
| ID | P | L | Assertion |
|---|---|---|---|
| B3.P0.1 | P0 | I | `POST /agents/:id/skills {skill_ids:[4]}` → `GET` returns 4 links **in order**. |
| B3.P1.1 | P1 | C | AgentEditor `SkillsTab` toggle posts the updated `skill_ids` via `useSetAgentSkills`. |

### FR-B4 — Skill import (md/zip, preview, untrusted)
| ID | P | L | Assertion |
|---|---|---|---|
| B4.P0.1 | P0 | I | `POST /skills/import` (base64 `.md`) → preview `{name from '# heading', type:'custom', source:'imported_url', ignored_files:[]}`, **nothing persisted** (`GET /skills` unchanged). |
| B4.P0.2 | P0 | I | `.zip` with `SKILL.md` + extra files → body from `SKILL.md`; extras listed in `ignored_files` (**not** read/executed). |
| B4.P1.1 | P1 | C | `ImportDrawer` shows the preview + "imported as **disabled**" warning; confirm → `POST /skills {enabled:false}`. |
| B4.P1.2 | P1 | I | Non-md/zip → `ValidationError`; payload > 5 MB → rejected. |

### FR-B5 — Without/with-skills experiment
| ID | P | L | Assertion |
|---|---|---|---|
| B5.P0.1 | P0 | I | Same agent + fixed breaking-change diff: run with `skill_ids:[]` → `prompt_assembly.skills === null`; run with 4 linked+enabled → non-null **containing the `breaking-change` body**. |
| B5.P0.2 | P0 | C | `TraceBody` renders the **Skills / rules** `PromptBlock` iff `prompt_assembly.skills != null`. |
| B5.P1.1 | P1 | I | Disabling a linked skill removes its body from the next run's prompt (enabled filter honored). |
| B5.M.1 | P0* | M | **Live LLM:** on a real breaking-change PR, the agent **without** skills produces no breaking-change finding; **with** skills it flags one + comments. *(manual P0 — direct acceptance #7)* |

### FR-S1 — Skill CRUD + versioning (infra prerequisite)
| ID | P | L | Assertion |
|---|---|---|---|
| S1.P0.1 | P0 | I | `POST /skills` → 201, `enabled:true`, `version:1`, `source:'manual'`, a `skill_versions` row. |
| S1.P1.1 | P1 | I | `PUT` body change bumps `version` + writes a version row; `PUT {enabled}` toggles without a bump; `GET …/versions` newest-first. |

---

## 2. Non-functional requirements → tests (P0)

| ID | P | L | Assertion |
|---|---|---|---|
| **N1** Injection security | N1.P0.1 | I/U | Extract **fences** repo file bodies in the untrusted delimiter (assert via `MockLLM.calls` that no raw file body sits in an instruction/system position). |
| | N1.P0.2 | I | Skill import never reads/executes non-md archive entries (they appear only in `ignored_files`) — ties B4.P0.2. |
| **N2** Determinism/testability | N2.P0.1 | U/I | All LLM-touching tests use `MockLLMProvider` (no network); pure seams (grounding, line, merge, sampling) are covered by hermetic unit tests. |
| **N3** Grounding invariant | N3.P0.1 | I | After any extract, **every** persisted candidate's `evidence_path` exists in the sampled fileset (no orphan/hallucinated paths reach the UI). |
| **N4** Bounded input (cost/latency) | N4.P0.1 | U | `collectConventionSamples` never exceeds `MAX_SAMPLE_BYTES` even with many/large files (truncates/limits deterministically). |
| **N5** Idempotence | N5.P0.1 | I | Re-extract preserves accepted candidates and doesn't duplicate rows (stronger form of A1.P1.1). |
| **N6** Multi-tenant isolation | N6.P0.1 | I | Workspace B cannot GET/accept/edit workspace A's conventions or skills (scoped by `workspaceId`; cross-access → not found/empty). |
| **N7** Type-safety & contract lock-step | N7.P0.1 | build | `pnpm typecheck` = 0 across client/server/reviewer-core; new contract fields (`evidence_line`, skill import types) present in **both** vendored `shared/` copies (a shared import compiles from each). |
| **N8** a11y & i18n | N8.P0.1 | C | New interactive controls (accept/reject/create-skill/evidence link/import) expose accessible names; new UI text comes from `messages/en/conventions.json` (no hardcoded strings). |
| **N9** No unintended LLM calls | N9.P0.1 | I | `list / accept / reject / edit / create-skill / link` perform **zero** LLM calls (`MockLLM.calls` unchanged across them) — only `extract` calls the model. |
| **N10** CI gate | N10.P0.1 | CI | `client.yml`, `server-unit.yml`, `server-integration.yml`, `reviewer-core.yml` all green on the PR. |

---

## 3. Acceptance-criteria coverage (Критерії приймання + Як перевірити)

| HW acceptance line | Covered by (test IDs) |
|---|---|
| Демо-відео: Extractor у дії **+** API Contract Reviewer без/зі скілами | §4 demo · A1–A8 (M) · B5.M.1 · B5.P0.1/2 |
| відкритий PR з гарним описом | packaging (impl C.1) — process |
| Conventions Extractor **дає результати на UI** | A1.P0.1, A2.P0.1, A2.P0.2 |
| з прийнятих кандидатів можна створити **1 скіл чи декілька**; **rejected не потрапляють** | A7.P0.1, A7.P0.2, A3.P0.1, A3.P1.* |
| кожен кандидат має **докази з реальним кодом, клік → файл на GitHub** | A5.P0.1, A5.P0.2, N3.P0.1, A6.P0.1 |
| згенерований скіл **прилінкувати до агента та запускати на ревʼю** | A8.P0.1, S1.P0.1, B5.P0.2 |
| API Contract Reviewer **зі скілами ловить breaking change, який без скілів пропускався** | B5.P0.1, B5.M.1 |
| **Як перевірити:** демо від запуску Extractor'а до прилінкованого скіла й експерименту | §4 (M-A.1..6, M-B.1) |
| **Як перевірити:** PR + короткий **звіт по якості знахідок Extractor'а** | M-A.6 (report) + packaging |
| **Як перевірити:** докази клікабельні → реальний код; `repo-conventions` прилінкований і запускається | A6.P0.1, A8.P0.1, N3.P0.1 |

**Every acceptance line maps to ≥1 P0 automated test and/or a manual demo step. No acceptance line is uncovered.**

---

## 4. Manual / demo checklist (drives the required video)

| ID | Step | Acceptance |
|---|---|---|
| M-A.1 | Conventions → **Re-scan** → candidates with confidence + evidence render | results-on-UI |
| M-A.2 | accept 2–3, **reject** ≥1; `N of M accepted` updates | rejected-excluded |
| M-A.3 | click an evidence link → correct **GitHub blob line** | evidence-clickable |
| M-A.4 | **Create skill** → modal "Merged from N accepted", edit, save → appears in Skills Lab; body contains **only accepted** rules | accepted→1-skill |
| M-A.5 | link the skill to an agent, run a review → **Skills / rules** block in the run trace | skill-linkable+runs |
| M-A.6 | write the short **finding-quality report** (candidates found / grounded / useful) for the PR | Як-перевірити report |
| M-B.1 | API Contract Reviewer on a breaking-change PR: **without** skills (miss) then **with** (catch + comment); both traces captured | with>without |
| M-video | record M-A.1→M-A.5 + M-B.1 as the demo; open the PR with description + report | video + PR |

---

## 5. Test inventory (counts)

- **Functional:** 13 FRs → **28 P0** + **26 P1** automated tests + the P0 manual (`B5.M.1`).
- **Non-functional:** 10 NFRs → **11 P0**.
- **Manual/demo:** 8 steps (the video + report).
- Cross-checked against doc 03: every ID here is produced by a phase step (doc 03 §7 matrix, updated to these IDs).
