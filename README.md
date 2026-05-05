# tte-ecommerce-api

Production-grade ecommerce API. Express + TypeScript + Drizzle (Postgres) +
Redis. Modular monolith organised by bounded context (auth, user, product,
inventory, cart, order, payment, discount), each module shaped so it can be
extracted to a service later with minimal refactor.

## Quick start

```bash
pnpm install
cp .env.example .env
# bring up postgres + redis (compose file not included)
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Health: `GET /health`. API root: `/api/v1`.

## Architecture at a glance

```
src/
  modules/<bounded-context>/
    domain/         # entities, value objects, repository interfaces
    application/    # use cases (single execute(input) per file)
    infrastructure/ # Drizzle repositories, integrations
    interfaces/http/ # controllers, routes, validators
    index.ts        # composition root + public surface
  shared/           # technical primitives only — no business logic
  infrastructure/   # cross-cutting (db, cache, events, schema)
  app.ts            # express composition
  server.ts         # process bootstrap
```

Layering: `domain → application → infrastructure → interfaces`. The `domain`
layer is framework-free.

## Critical design notes

### Concurrency-safe order creation
`CreateOrder` (`src/modules/order/application/use-cases/CreateOrder.ts`)
runs everything inside a single Postgres transaction:

1. `idempotency_keys` row is acquired (`Idempotency-Key` HTTP header).
   Reuse with same payload → replay; reuse with different payload → 409.
2. Cart loaded; prices re-resolved from authoritative `product_variants`.
3. Coupon (if any) re-validated.
4. `inventory.lockAndDeduct` issues `SELECT ... FOR UPDATE` on the involved
   variants in a deterministic (sorted-by-id) order to avoid deadlocks,
   verifies stock, then deducts `on_hand` and writes a row to
   `inventory_ledger`.
5. `orders` + `order_items` inserted.
6. `cart.status = 'converted'`.
7. `OrderCreated` event written to `event_outbox` — atomic with the order
   insert (transactional outbox pattern).
8. Idempotency row finalised with the response body.

If any step fails, the entire transaction rolls back, including the inventory
deduction and the outbox event.

### Event flow
`OrderCreated → PaymentProcessed → InventoryUpdated → NotificationSent`

- The outbox table is the durable record. A relay
  (`startOutboxRelay`) drains rows on an interval and forwards them to the
  configured downstream bus. The current bus is in-memory; swap for RabbitMQ
  or Kafka in `wireDomainEventHandlers` without touching domain code.
- `order.created` is handled by the payment module (`ProcessPayment`), which
  charges via `PaymentGateway` and sets order status to `paid` on capture.
- Inventory was already deducted at order creation; a future
  `payment.captured` handler can release reserved-but-unpaid holds in a
  reservation-based model.

### Caching
Product list and detail responses are cached in Redis (`product:list:*`,
`product:detail:*`). On product mutations, invalidate via
`redisCache.invalidatePrefix('product:')`.

### Pagination
Cursor-based, opaque base64url-encoded `(createdAt, id)` keyset cursor in
`@shared/types.ts`. No `OFFSET`.

### Security
- argon2id password hashing (mem 19 MiB).
- JWT access tokens (short TTL, default 15 min) + refresh tokens stored as
  SHA-256 hashes in `refresh_tokens`. Refresh rotates on every use; reuse of
  a revoked token revokes the entire family.
- Per-route rate limiting via Redis-backed `express-rate-limit`. Stricter
  limits on `/auth/*`.
- Helmet, CORS, request-size limit, x-request-id correlation.
- All input validated with Zod at the controller boundary.

### Money
Always integer minor units. `Money` type alias in `@shared/types.ts`. Never
floats.

## Folder map

| Path | Purpose |
|------|---------|
| `src/modules/auth` | Register, login, refresh rotation, logout, JWT middleware |
| `src/modules/user` | User entity, repository |
| `src/modules/product` | Product + variants, list/detail with caching |
| `src/modules/inventory` | Stock with `FOR UPDATE` deduction + ledger |
| `src/modules/cart` | Guest + authenticated carts, AddToCart, ApplyCoupon |
| `src/modules/discount` | Coupon validation and discount calculation |
| `src/modules/order` | CreateOrder (txn-safe + idempotent), state machine |
| `src/modules/payment` | Abstract `PaymentGateway`, mock provider |
| `src/shared` | Errors, response shape, logger, async-handler, env, types |
| `src/infrastructure/db` | Drizzle client, schema, migrate runner |
| `src/infrastructure/cache` | Redis client + cache port |
| `src/infrastructure/events` | Outbox publisher, in-memory bus, relay |

## Testing

Vitest. Use cases get unit tests with in-memory repository fakes
(see `discount/application/use-cases/ValidateCoupon.test.ts`).
Repositories get integration tests against a real Postgres.

```bash
pnpm test
pnpm test:cov
```

## Working with Claude on this project

Read `CLAUDE.md` and `.claude/commands/`. The configuration is tuned for
token-efficient collaboration: assume the architecture, reference paths
instead of re-pasting, patch instead of rewriting. Use
`/new-module` and `/add-use-case` to scaffold consistently.
