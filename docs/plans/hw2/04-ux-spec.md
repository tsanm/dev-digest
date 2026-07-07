# HW-2 — UX Spec (from the HW mockups)

Pixel-intent for Part A's two screens, so the build matches the design. Reuse existing primitives (`ProgressBar`, `MonoLink`, `Toggle`, the lab's SkillEditor `ConfigTab` form, `githubBlobUrl`, the copy affordance) — don't reinvent.

## Nav
`Conventions` is an item in the **SKILLS LAB** nav section (with Skills · Agents · Conventions · Eval Dashboard). The page is scoped to the repo chosen in the top-left workspace switcher. Breadcrumb: `Skills Lab › Conventions`.

## View 1 — Conventions list (`/repos/[repoId]/conventions`)

**Header row**
- Title: `Conventions in <repo>` — repo name in accent color.
- Subtitle: `Detected from <N> sample files · last scan <relative time>` (from the last extract run's metadata).
- Right: **Re-scan** button (refresh icon + label) → `POST /repos/:id/conventions/extract`; shows a spinner while running.

**Selection toolbar** (above the list)
- **✕ Deselect all** — clears the accepted set (rejects/unaccepts all).
- `<N> of <M> accepted` — live counter (accepted = the selection that feeds the skill).
- **✨ Create skill** (right, accent) — opens View 2; **disabled when 0 accepted**.

**Convention card** (one per candidate)
- **Left accent border**: green when accepted (matches the selected state).
- **Rule** — italic, prominent (e.g. *"Always use async/await instead of .then() chains"*).
- **Evidence box** (dark, rounded):
  - `path:lineStart-lineEnd` in mono, as a **link → GitHub blob** (`githubBlobUrl(repoFullName, headSha, path, line, line)`), **plus** a **copy icon** (copies `path:lines`).
  - the code **snippet** in a `<pre>` block.
- **Confidence** — label + `ProgressBar`, **color by threshold**: green ≥ 0.85, orange below (`confidenceColor()`), with `NN%`.
- **Actions** (right column): **✓ Accepted** (filled/blue when accepted — toggles accept) and **✕ Reject** (below).
- **Edit** (capability #4): click the rule text → inline edit (input) → save via `PUT /conventions/:id`; on snippet edit, server re-grounds.

**States**: skeleton while loading; empty state before first scan (CTA = Re-scan); error state on extract failure.

## View 2 — "Create skill from conventions" modal

Opened from **Create skill**. It is the **skill-editor form prefilled from the merge** (reuse the lab's `SkillEditor` ConfigTab fields).

- **Header**: title `Create skill from conventions` + subtitle = proposed skill name (`<repo>-conventions`) + close ✕.
- **Info banner**: `🔧 Merged from <N> accepted conventions in <repo>. Everything below is editable before you save.`
- **Name*** — default `<repo>-conventions`.
- **Description** — default `<N> house conventions extracted from <repo>`.
- **Type** — dropdown (`convention` default; also rubric/security/custom).
- **Enabled** — toggle (on) + caption `Whether this block is added to agents' prompts.`
- **Skill body*** — markdown editor:
  - editor header: `<name>.md` + an **`unsaved`** badge + **token count** (`<n> tokens`, from the server tokenizer adapter / client estimate).
  - line-numbered, syntax-highlighted; content = the generated merge body (below), fully editable.
- **Footer**: left status `Saved as v1 · added to Skills Lab` (post-save); **Cancel** · **✨ Create skill** (accent) → `POST /repos/:id/conventions/skill` → returns the new skill; then surface a **"Link to agent"** affordance (select an agent → `POST /agents/:id/skills`).

### Generated merge body (exact format)
```
# <name>

House conventions for `<repo>`. Flag changes that violate any rule below and cite the offending `file:line`.

## <rule-slug>            ← one section per ACCEPTED candidate, deterministic order
<rule text>

Detected in `<path:lineStart-lineEnd>`:
​```
<evidence snippet>
​```
```
`<rule-slug>` = a kebab-cased slug of the rule (e.g. `async-await-then-chains`). Rejected/unaccepted candidates are **absent**.

## Primitive reuse map
| UX element | Reuse |
|---|---|
| Confidence bar (green/orange) | `ProgressBar` + `confidenceColor()` (reference ConventionCard) |
| Evidence path link | `githubBlobUrl` (`lib/github-urls.ts:24`) |
| Copy icon | existing copy button pattern (e.g. FindingCard / code blocks) |
| Type dropdown / Enabled toggle / body editor | lab `SkillEditor` `ConfigTab` |
| Token count | server tokenizer adapter (`adapters/tokenizer/`) or client estimate |
| Modal shell | existing modal/drawer primitive |

## Delta to the test/impl plan (folded in)
- Modal **token count** → add a small util + display (component test asserts a token number renders).
- **Deselect all** + `N of M accepted` counter → `ConventionsView` state + test (TA.14 extended).
- Merge body **exact format** → `mergeConventionsSkillBody` matches this template (TA.3 asserts the `# / ## <slug> / Detected in` shape).
