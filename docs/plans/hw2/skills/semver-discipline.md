# semver-discipline

**Directive:** Require a MAJOR version bump whenever the diff contains a breaking change. Flag when the declared version — in `package.json`, an API `version` constant, or an OpenAPI `info.version` — does not reflect the change.

## When it applies
Reviewing a PR that changes a public contract; cross-check it against the version declared anywhere in the same diff (or note that no bump is present).

## Rules
- **CRITICAL** — the diff contains a breaking change (removed/renamed public contract, new required field, changed response type) but the version is **not** major-bumped.
- **WARNING** — new backwards-compatible features are added without a **minor** bump.
- **INFO** — bug-fix-only changes (patch bump is enough).
- A version bump alone does **not** excuse a breaking change with no migration/deprecation path — pair this with `deprecation-policy`.
- Cite the version location and the breaking `file:line` it should reflect.

## Good — MAJOR bump matches a breaking change
```diff
- "version": "2.4.1",
+ "version": "3.0.0",   // a response field was renamed elsewhere in this PR → MAJOR bump
```

## Bad — breaking change with no bump
```diff
  "version": "2.4.1",   // unchanged…
- export const UserDto = z.object({ id: z.string(), userName: z.string() });
+ export const UserDto = z.object({ id: z.string(), name: z.string() }); // …despite a BREAKING rename → should be 3.0.0
```
