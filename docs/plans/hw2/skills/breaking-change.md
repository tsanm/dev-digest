# Breaking Change Guard

Flag any change that removes or renames a **public** API contract without a backwards-compatible path. Applies when reviewing a PR diff of routes, DTOs, or exported types.

## Rule
- **CRITICAL** when a public route is removed, or its method/path changes.
- **CRITICAL** when a request or response field is **removed** or **renamed**.
- **CRITICAL** when a **new required** request field is added (old clients break).
- **WARNING** when an enum value is removed, or a type is narrowed (e.g. `string` → a literal union).
- A change is **NOT** breaking if the old contract still works: an additive *optional* field, a new route, a widened type.
- Cite the exact `file:line` of the offending contract change.

## Good
```diff
  export const UserDto = z.object({
    id: z.string(),
    name: z.string(),
+   nickname: z.string().optional(),   // additive OPTIONAL field — old clients unaffected
  });
```

## Bad
```diff
  export const UserDto = z.object({
    id: z.string(),
-   userName: z.string(),
+   name: z.string(),                  // renamed userName → name: BREAKING for every client
  });
- app.get('/users/:id', handler);
+ app.get('/v2/users/:id', handler);   // route path changed with no alias: BREAKING
```
