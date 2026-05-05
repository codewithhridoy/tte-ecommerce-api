# tte-ecommerce-api — Claude collaboration guide

## Domain

**B2C ecommerce, modular monolith.** Each `src/modules/<bounded-context>` is a
self-owned domain that could be extracted to a microservice. Cross-module
contact is via application-service interfaces or domain events — never via
direct DB access into another module's tables.

Bounded contexts: `auth`, `user`, `product`, `inventory`, `cart`, `order`,
`payment`, `discount`.

Authoritative terms (use these exactly — do not invent synonyms):

- **Product** has many **ProductVariant**. Inventory is tracked per variant.
- **Cart** has **CartItem**s. A cart is owned by either a `userId` (auth) or
  an opaque `guestToken`. Carts merge on login.
- **Order** is built from a cart snapshot and immutable once created. Order
  state is governed by an explicit state machine — never mutate `order.status`
  outside the `OrderStateMachine` value object.
- **Inventory** stocks are decremented inside the order-creation transaction
  with `SELECT ... FOR UPDATE` to prevent oversell. Never decrement outside a
  transaction.
- **Payment** is provider-agnostic; concrete providers implement
  `PaymentGateway` from `modules/payment/domain`.
- **Coupon** is the persistence; **Discount** is the calculated effect on a
  cart total.

## Architecture rules (enforce — do not regress)

1. Layering inside a module: `domain` → `application` → `infrastructure` →
   `interfaces`. Higher layers depend only on lower ones.
2. `domain/` imports nothing framework-specific (no Express, no Drizzle).
3. Controllers are thin: validate → call use case → format response.
4. Repositories are the *only* DB access. Use cases depend on repository
   *interfaces* defined in `domain/`, not on Drizzle directly.
5. The `shared/` folder holds technical primitives only (errors, logger,
   result type, http helpers). No business rules in `shared/`.
6. Cross-module communication: prefer events (outbox → bus). For sync calls,
   inject the other module's *application service interface*, not its repo.
7. All write paths that touch money or stock must be transactional and
   idempotent (use `idempotency_keys` table).

## Token economy when collaborating

When asked to extend the system:

- **Don't restate** the architecture, schema, or folder layout — assume it.
- **Reference, don't reproduce.** Cite a path (`src/modules/order/...`)
  instead of pasting the file when explaining.
- **Patch, don't rewrite.** Prefer `Edit` over `Write` on existing files.
- **One bounded context per response** when a change spans many; surface a
  one-line plan first, then implement.
- **Skip prose summaries** of code you just wrote — the diff is the summary.
- For new features, add to the existing module that owns the concept; only
  create a new module if a genuinely new bounded context is being introduced
  (and call that out explicitly with reasoning).

## Code style (project-specific overrides)

- ESM, NodeNext. No CommonJS `require`.
- `verbatimModuleSyntax: true` is on — `import type { ... }` for type-only.
- `noUncheckedIndexedAccess: true` is on — handle `T | undefined` from
  arrays/records.
- Errors: throw subclasses of `AppError` from `@shared/errors`. Never throw
  bare `Error` from a use case.
- Money: integer minor units (cents) — never floats. Type alias `Money`.
- IDs: `uuid` v7 via `@shared/id`. Never expose internal numeric IDs.
- Time: `Date` at the boundary, ISO strings on the wire.

## Testing

- Vitest. Tests colocated as `*.test.ts` next to source where it's a unit
  concern; `tests/integration/<module>/` for integration.
- Use cases get unit tests with in-memory repository fakes.
- Repositories get integration tests against a real Postgres (testcontainers
  or a dedicated test DB).
- 80%+ coverage gate.

## Common commands

- `pnpm dev` — dev server with reload
- `pnpm typecheck` — full type check (run before declaring work done)
- `pnpm test` — Vitest
- `pnpm db:generate` — Drizzle migrations from schema
- `pnpm db:migrate` — apply migrations
