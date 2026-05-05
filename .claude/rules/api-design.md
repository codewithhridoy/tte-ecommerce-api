# API design rules

## Versioning

- All routes mounted under `/api/v1`.
- Breaking change → `/api/v2`. Maintain v1 until deprecation policy
  signs off.

## Response shape

Every response is `ApiResponse<T>` from `@shared/http/response`:

```ts
type ApiSuccess<T> = { success: true; data: T; meta?: PaginationMeta }
type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } }
```

Helpers: `ok(data, meta?)`, `fail(code, message, details?)`. Don't hand-roll.

## Status codes

| Code | When |
|------|------|
| 200 | GET success, idempotent replay of POST |
| 201 | New resource created |
| 204 | Success, no body (e.g. logout) |
| 400 | Validation error (Zod / ValidationError) |
| 401 | Authentication required / invalid |
| 403 | Authenticated but not allowed |
| 404 | Resource missing |
| 409 | Conflict — duplicate, idempotency-key reuse with different payload |
| 412 | Precondition failed — insufficient stock, coupon limit reached |
| 422 | Reserved for "well-formed but semantically wrong" if Zod 400 isn't enough |
| 429 | Rate limited |
| 500 | Unhandled — surface generic message, never leak internals |

`AppError` subclasses already map to these. Never set status manually if an
`AppError` would do.

## Error codes

Strings, SCREAMING_SNAKE, defined in `@shared/errors` `ErrorCode`. New code?
Add it to the union — don't string-literal it.

## Pagination

Cursor-based only. Request: `?cursor=<opaque>&limit=20`. Response includes
`meta: { nextCursor?, hasMore, limit }`. Limits clamped server-side
(default 20, max 100).

## Idempotency

POSTs that create or trigger side effects accept `Idempotency-Key` header
when applicable. `POST /orders` requires it. The replay response sets
`Idempotent-Replayed: true` header.

## Validation

- Zod at the controller boundary, parsed before reaching the use case.
- Body, query, and params each validated separately (don't mix).
- Numeric query params use `z.coerce.number()` since query strings are
  always strings.

## HTTP method semantics

- GET: safe + idempotent. No side effects, ever.
- POST: create / trigger. Accept `Idempotency-Key` where appropriate.
- PUT: full replace. Idempotent by definition.
- PATCH: partial update. Use sparingly — prefer command-style endpoints
  for non-trivial mutations.
- DELETE: idempotent.

## Auth on routes

- Protected route → mount with `requireAuth`. Visible to guests too →
  `optionalAuth` so `req.auth` is populated when present.
- Admin-only → `requireAuth` + `authorize('admin')`.

## OpenAPI

Zod schemas are the source of truth. When OpenAPI generation is added
(`zod-to-openapi`), do not duplicate schema definitions in YAML.
