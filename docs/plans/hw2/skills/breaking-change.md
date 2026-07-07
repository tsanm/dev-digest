# breaking-change

**Directive:** Flag any change that removes or renames a public API contract — a route, a request/response field, or an exported type — when there is no backwards-compatible path. Mark it CRITICAL and cite the exact `file:line`.

## When it applies
Reviewing a PR diff that touches public routes, DTOs/schemas, or exported types that external consumers depend on.

## Rules
- **CRITICAL** — a public route is removed, or its method/path changes with no alias.
- **CRITICAL** — a request or response field is **removed** or **renamed**.
- **CRITICAL** — a **new required** request field is added (old clients that don't send it break).
- **WARNING** — an enum value is removed, or a type is narrowed (e.g. `string` → a literal union).
- **NOT breaking** — the old contract still works: an additive *optional* field, a brand-new route, a widened type.
- Always state *what* broke and cite the offending `file:line`.

## Good — additive, backwards-compatible
```diff
  export const UserDto = z.object({
    id: z.string(),
    name: z.string(),
+   nickname: z.string().optional(),   // additive OPTIONAL field — old clients unaffected
  });
```

## Bad — rename + route change with no alias
```diff
  export const UserDto = z.object({
    id: z.string(),
-   userName: z.string(),
+   name: z.string(),                  // renamed userName → name: BREAKING for every client
  });
- app.get('/users/:id', handler);
+ app.get('/v2/users/:id', handler);   // path changed with no alias/redirect: BREAKING
```
