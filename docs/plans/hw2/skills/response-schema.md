# Response Schema Discipline

Flag changes to the **shape** of an API response — field types, requiredness, nullability — when reviewing a PR diff. Response shape is a consumer contract even when the route path is unchanged.

## Rule
- **CRITICAL** when a response field's type changes (e.g. `string` → `number`, object → array).
- **CRITICAL** when a previously-**required** response field is dropped or made nullable.
- **WARNING** when a field's *meaning* changes without a rename (silent semantic drift — same name, different value).
- **WARNING** when date/number formats change (ISO string → epoch, cents → dollars).
- Additive **optional** response fields are fine.
- Cite `file:line` and name the field + old→new shape.

## Good
```diff
  const body = {
    id: user.id,
    createdAt: user.createdAt.toISOString(),
+   plan: user.plan ?? null,          // additive, nullable — safe to add
  };
```

## Bad
```diff
  const body = {
    id: user.id,
-   createdAt: user.createdAt.toISOString(),   // was ISO-8601 string
+   createdAt: user.createdAt.getTime(),       // now epoch number: type + format change, BREAKING
-   balanceCents: acct.cents,
+   balance: acct.cents / 100,                 // required field dropped + semantics changed
  };
```
