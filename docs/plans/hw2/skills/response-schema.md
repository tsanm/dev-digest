# response-schema

**Directive:** Flag changes to the shape of an API response — a field's type, requiredness, nullability, or format — that break existing consumers. Name the field and its old→new shape, and cite `file:line`. Response shape is a contract even when the route path is unchanged.

## When it applies
Reviewing a PR diff that changes what a handler returns: response DTOs, serializers, or the object passed to `res.json(...)`.

## Rules
- **CRITICAL** — a response field's **type** changes (`string` → `number`, object → array).
- **CRITICAL** — a previously **required** response field is dropped or made nullable.
- **WARNING** — a field's **meaning** changes without a rename (silent semantic drift: same name, different value).
- **WARNING** — a number/date **format** changes (ISO string → epoch, cents → dollars).
- **OK** — additive **optional/nullable** response fields.
- Cite `file:line` and always name the field plus the old→new shape.

## Good — additive, nullable
```diff
  const body = {
    id: user.id,
    createdAt: user.createdAt.toISOString(),
+   plan: user.plan ?? null,          // additive, nullable — safe to add
  };
```

## Bad — type + format change and a dropped required field
```diff
  const body = {
    id: user.id,
-   createdAt: user.createdAt.toISOString(),   // was ISO-8601 string
+   createdAt: user.createdAt.getTime(),       // now epoch number: type + format change, BREAKING
-   balanceCents: acct.cents,                  // required field dropped…
+   balance: acct.cents / 100,                 // …and semantics changed (cents → dollars)
  };
```
