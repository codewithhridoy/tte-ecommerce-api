# Architecture rules — non-negotiable

## Layering inside a module

```
domain → application → infrastructure → interfaces
```

Higher layers may depend on lower ones. Never the reverse.

| Layer | May import | May NOT import |
|-------|------------|----------------|
| `domain/` | only other things in `domain/` of the same module, plus `@shared/errors`, `@shared/types`, `@shared/id` | Express, Drizzle, `pg`, ioredis, jsonwebtoken, zod (use plain TS in domain), any other module |
| `application/` | own `domain/`, *interfaces* from other modules' `domain/`, `@shared/*`, zod | own `infrastructure/`, any `infrastructure/` of other modules, Express |
| `infrastructure/` | own `domain/`, `@infra/*`, `@shared/*` | other modules' `infrastructure/`, Express |
| `interfaces/http/` | own `application/`, own `domain/` types, `@shared/http/*`, Express, zod | direct DB access (`@infra/db`), repositories of *other* modules |

## Module boundaries

- A module is a directory under `src/modules/`. The directory name **is** the bounded context name.
- A module's public surface is *only* what `<module>/index.ts` exports.
- Other modules import only from `@modules/<name>/index.js` — never reach into `@modules/<name>/infrastructure/...` or `@modules/<name>/domain/entities/...`.
- Cross-module DB joins are forbidden. If two modules need data together, the calling use case loads from each module's repository and combines in memory, or subscribes to a domain event.

## Composition

- Each module exposes `buildXModule(deps): XModule` returning routes + the
  interfaces other modules may consume.
- `src/app.ts` is the **only** place that wires modules together.
- Do not call `buildXModule()` from inside another module.

## Dependency injection

- Use cases receive repositories and services through their constructor.
- Never call `new DrizzleXRepository(db)` from a use case — that's the
  composition root's job.
- Never reference a global `db` from inside a use case (transactions are
  passed in as `tx`).

## Money & ids

- Money: integer minor units, type alias `Money` from `@shared/types`. Float
  arithmetic on money values is forbidden — see `rules/money.md`.
- IDs: `newId()` from `@shared/id` (uuid v7). Never expose internal numeric ids.
- Time: `Date` at the boundary, ISO strings on the wire.

## Errors

- Throw subclasses of `AppError` (`@shared/errors`). Never throw bare `Error`
  from a use case or controller. Bare `Error` is allowed in
  `infrastructure/` only for "should-never-happen" invariants.
- Controllers don't catch `AppError` — let the central error handler render it.

## Transactions

- Any operation that touches money or stock must be transactional.
- Repositories that participate in a transaction must accept `DbExecutor`
  (the union of `DbClient | DbTransaction`) explicitly — see
  `InventoryRepository.lockAndDeduct(tx, ...)`.
- The use case opens the transaction (`db.transaction(async (tx) => ...)`)
  and threads `tx` through.

## Idempotency

- Any external-facing write that is non-idempotent by nature (place order,
  charge payment, refund) must be guarded by an `Idempotency-Key` header
  and an entry in `idempotency_keys`.
- See `CreateOrder.execute` for the canonical pattern.

## Events

- Domain events go through the outbox (`enqueueOutbox(tx, event)`) inside
  the same transaction as the aggregate write. Never publish directly to
  the bus from inside a use case.
- Event payloads are versioned implicitly by `eventType`. Breaking-change a
  payload? Use a new `eventType` (`order.created.v2`) and migrate handlers.
