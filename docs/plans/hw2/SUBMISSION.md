# HW-2 — Conventions Extractor + API Contract Reviewer (Skills)

**One line:** Built the L2 **Skills mechanism** end-to-end, then two features on top of it — a **Conventions Extractor** that turns a repo's house-rules into a linkable Skill, and an **API Contract Reviewer** agent whose skills catch breaking changes a naked agent misses.

---

## What was built

### Part A — Conventions Extractor
Scan a cloned repo → LLM proposes candidates `{category, rule, evidence:file+line, confidence}` → **ground every candidate in code** (drop hallucinated paths; cap ungrounded confidence at 0.5; derive the line) → accept/reject/edit in the UI → merge accepted into **one `repo-conventions` skill** (evidence cited as clickable `file:line` → GitHub) → link to an agent.

- **Server:** `modules/conventions/` — `POST /repos/:id/conventions/extract`, list/accept/reject/edit, `POST .../skill`. Deterministic sample selection in code (eslint/tsconfig/prettier + top files + code-index) → one structured LLM call → grounding.
- **Client:** `/repos/:id/conventions` — candidate cards (rule · category · confidence · clickable evidence · snippet), accept/reject/edit, Create-skill modal (merged body, token count, link-to-agent).

### The Skills mechanism (L2 foundation)
Markdown rule-blocks `{name, type, description, body}` stored in `skills`/`skill_versions`; linked+ordered per agent (`agent_skills`); injected into the review prompt as a **`## Skills / rules`** block, surfaced in the run trace with token counts; **safe file import** (untrusted body wrapped, lands disabled until vetted).

- **Server:** `modules/skills/` — CRUD + body-versioning + import-with-untrusted-wrap + link-to-agent.
- **Client:** `/skills` (list · preview · inline edit · create · import drawer); agent editor **Skills tab** (link · enable · reorder, explicit **Save**).

### Part B — API Contract Reviewer
An agent with a **neutral prompt** (role only, no rules) plus **4 skills** — `breaking-change`, `response-schema`, `semver-discipline`, `deprecation-policy` — each a directive with a good/bad example. Skills carry the knowledge; the prompt just scopes the role.

### Supporting infra added this round
Per-finding **skill attribution** (`Finding.rule`, populated by the model, **stripped on baseline runs**); **By severity / By skill** grouping in the findings panel; per-run **skills snapshot** (`skills_count` + `skill_names` on the run, shown as chips); a per-run **baseline (skip_skills)** option for one-click with/without comparison.

---

## Finding-quality report (Conventions Extractor on `tsanm/dev-digest`)

| Metric | Value |
|---|---|
| Candidates | **21** |
| Distinct categories | **11** (database-schema, react-query, api-client, api-shape, secrets, multi-tenancy, http…) |
| Grounded (real `file:line`) | **21 / 21 (100%)** |
| Evidence path exists on disk | **21 / 21 (100%)** |
| Confidence | min 0.50 · avg **0.90** · max 0.99 |
| Correctly down-weighted by grounding (≤0.5) | 3 (snippet not found verbatim) |

**Takeaway:** every surfaced candidate cites code that actually exists (no hallucinated evidence), and grounding transparently caps the 3 weaker matches. Categories are diverse (schema, API, security, multi-tenancy), so accepted candidates make a genuinely useful house-rules skill.

*Quality levers used:* config-file + code-index-aware sampling, single structured call, mechanical grounding gate, and stable ordering (`confidence DESC`).

---

## Acceptance criteria → evidence

| # | Criterion | Status |
|---|---|---|
| 3 | Conventions Extractor gives results on UI | ✅ `/repos/:id/conventions`, 21 live candidates |
| 4 | Accepted → 1 or several skills; rejected excluded | ✅ `service.createSkill` merges `listAccepted` only (server test A7 + A7b) |
| 5 | Each candidate has real-code evidence; click → GitHub | ✅ grounding (100% on disk) + `githubBlobUrl` (card test A6) |
| 6 | Generated skill linkable to agent + runs on review | ✅ link + run-executor injection (trace shows the block) |
| 7 | API Contract Reviewer with skills catches a break missed without | ✅ live A/B: **baseline score 100 / 0 findings** vs **with-skills score 30 / 2 CRITICAL** |
| 1–2 | Demo video · Open PR w/ description + report | 🎥 recorded separately · this doc = the PR body |

---

## Testing

| Package | Tests | Typecheck |
|---|---|---|
| reviewer-core | 25 | 0 |
| server (unit) | 111 | 0 |
| server (integration, testcontainers) | conventions.it, skills.it, reviews.it (incl. injection, attribution, baseline-strip) | 0 |
| client | 47+ (Conventions, Skills, SkillsTab, FindingsPanel by-skill, RunHistory chips, VerdictBanner) | 0 |

Prioritized TDD (P0/P1 per functional + non-functional requirement) in `docs/plans/hw2/02-test-and-verification-plan.md`.

---

## How to try it (2 repos, by design)

- **Conventions (needs a clone + real GitHub):** `tsanm/dev-digest` → **Conventions** → Run extraction → accept/reject → Create skill (link to an agent) → the evidence `file:line` opens on GitHub.
- **API Contract A/B (reads the PR diff, no clone needed):** `acme/payments-api #482` → **Run Review → Run with skills** vs **Run baseline (no skills)** → compare the two runs; the with-skills run flags the breaking change (grouped **By skill**), the baseline misses it.
