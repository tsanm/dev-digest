# Deprecation Policy

Require **deprecate-then-remove** for public contracts instead of silent removal. Applies when reviewing a PR diff that deletes or changes a public route, field, or exported symbol.

## Rule
- **CRITICAL** when a public field/route/export is removed with **no** prior `@deprecated` marker and no sunset note.
- **WARNING** when something is newly marked `@deprecated` **without** naming a replacement or a removal version/date.
- **Preferred pattern:** mark `@deprecated` (JSDoc/`Deprecation` header), keep it working, document the replacement and the version it will be removed in — then remove in a later MAJOR release.
- Cite `file:line` and state what should have been deprecated first.

## Good
```diff
  export const UserDto = z.object({
    id: z.string(),
+   /** @deprecated use `name`; removed in v4.0.0 */
    userName: z.string().optional(),
+   name: z.string(),                 // new field added; old one kept + deprecated
  });
```

## Bad
```diff
  export const UserDto = z.object({
    id: z.string(),
-   userName: z.string(),             // removed outright, no @deprecated period: clients break silently
+   name: z.string(),
  });
```
