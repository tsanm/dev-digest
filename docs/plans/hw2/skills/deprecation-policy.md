# deprecation-policy

**Directive:** Require deprecate-then-remove for public contracts. Flag any silent removal that lacks a prior `@deprecated` marker, a named replacement, and a sunset version. Never let a public field/route/export disappear without a migration window.

## When it applies
Reviewing a PR diff that deletes or replaces a public route, response/request field, or exported symbol.

## Rules
- **CRITICAL** — a public field/route/export is removed with **no** prior `@deprecated` marker and no sunset note.
- **WARNING** — something is newly marked `@deprecated` **without** naming a replacement or a removal version/date.
- **Preferred pattern** — mark `@deprecated` (JSDoc or a `Deprecation` header), keep the old contract working, document the replacement and the version it will be removed in, then remove it in a later MAJOR release.
- Cite `file:line` and state exactly what should have been deprecated first.

## Good — deprecate, keep working, name the replacement
```diff
  export const UserDto = z.object({
    id: z.string(),
+   /** @deprecated use `name`; removed in v4.0.0 */
    userName: z.string().optional(),
+   name: z.string(),                 // new field added; old one kept + deprecated
  });
```

## Bad — silent removal
```diff
  export const UserDto = z.object({
    id: z.string(),
-   userName: z.string(),             // removed outright, no @deprecated window: clients break silently
+   name: z.string(),
  });
```
