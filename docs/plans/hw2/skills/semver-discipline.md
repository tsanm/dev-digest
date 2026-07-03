# SemVer Discipline

Judge whether a PR's changes warrant a **MAJOR** version bump, and flag when the version (in `package.json` / an API `version` constant / an OpenAPI `info.version`) doesn't reflect the change.

## Rule
- **CRITICAL** when the diff contains a breaking change (removed/renamed public contract, new required field, changed response type) but the version is **not** major-bumped.
- **WARNING** when new backwards-compatible features are added without a **minor** bump.
- **INFO** for bug-fix-only changes (patch).
- A version bump alone doesn't excuse a breaking change with no migration/deprecation path — pair with `deprecation-policy`.
- Cite the version location and the breaking `file:line` it should reflect.

## Good
```diff
- "version": "2.4.1",
+ "version": "3.0.0",   // response field renamed elsewhere in this PR → MAJOR bump
```

## Bad
```diff
  "version": "2.4.1",   // unchanged…
- export const UserDto = z.object({ id: z.string(), userName: z.string() });
+ export const UserDto = z.object({ id: z.string(), name: z.string() }); // …despite a BREAKING rename → should be 3.0.0
```
