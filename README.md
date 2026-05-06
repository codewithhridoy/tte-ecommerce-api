# tte-ecommerce-api

Production-grade ecommerce API. Express + TypeScript + Drizzle (Postgres) +
Redis + RabbitMQ. Modular monolith organised by bounded context (auth, user,
product, inventory, cart, order, payment, discount), each module shaped so it
can be extracted to a microservice with minimal refactor.

## Quick start (local, no Docker)

```bash
pnpm install
cp .env.example .env        # fill in secrets
docker compose up -d postgres redis rabbitmq   # infra only
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Health: `GET /health`. API root: `/api/v1`.

## Docker

### Prerequisites
- Docker >= 24
- Docker Compose v2 (`docker compose`, not `docker-compose`)
- `make` (GNU Make)

Run `make help` to list every available target.

### Development

```bash
make up          # start postgres + redis + rabbitmq + app (hot reload)
make logs        # tail all logs
make logs-app    # tail app only
make shell       # sh into the running app container
make db-migrate  # run Drizzle migrations inside the container
make down        # stop everything
```

The app container mounts the project root as a bind volume so `tsx watch`
picks up source changes without rebuilding the image.

Service ports on the host (dev):

| Service            | Host port |
|--------------------|-----------|
| App                | 3000      |
| Postgres           | 5433      |
| Redis              | 6380      |
| RabbitMQ AMQP      | 5672      |
| RabbitMQ UI        | 15672     |

### Production

Create `.env.production` from `.env.example`, then:

```bash
make prod-build  # build the prod image (compiled dist, no devDeps)
make prod-up     # start the full production stack
make prod-logs   # tail logs
make prod-down   # stop
```

In production the internal services (Postgres, Redis, RabbitMQ) are **not**
exposed to the host. Only the app listens on port 3000. Put a reverse proxy
(nginx, Caddy) in front.

Required extra env vars for production (not in `.env.example`):

```
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
REDIS_PASSWORD=...
RABBITMQ_USER=...
RABBITMQ_PASS=...
```

### Cleanup

```bash
make clean          # remove containers + local images, keep volumes
make clean-volumes  # remove everything including named volumes (data loss)
```

## Redis

Redis is used for two purposes:

**Rate limiting** — `express-rate-limit` with `rate-limit-redis` as the store.
All write endpoints share a default limiter; `/auth/*` has its own stricter
one configured in `src/modules/auth/interfaces/http/`.

**Response caching** — product list and detail responses are cached under
`product:list:*` and `product:detail:*` keys. The cache client lives in
`src/infrastructure/cache/`. On any product mutation, call:

```ts
await redisCache.invalidatePrefix('product:')
```

Connection is configured via `REDIS_URL` in `.env`. The client is a single
`ioredis` instance created in `src/infrastructure/cache/redisClient.ts` and
shared across the process.

## RabbitMQ

RabbitMQ is the target message broker for domain events. The current
implementation uses the **transactional outbox pattern**:

1. A domain event (e.g. `OrderCreated`) is written to `event_outbox` in the
   same Postgres transaction as the aggregate write — guaranteed delivery.
2. `startOutboxRelay` (called from `server.ts`) polls the outbox on an
   interval and publishes pending rows to the configured bus.
3. The bus is wired in `src/infrastructure/events/`. To switch from the
   in-memory bus to RabbitMQ, set `EVENT_BUS_DRIVER=rabbitmq` and ensure
   `RABBITMQ_URL` is set. No domain code changes required.

### Management UI

Browse exchanges, queues, and message rates at
`http://localhost:15672` (dev credentials: `guest` / `guest`).

### Event flow

```
OrderCreated → PaymentProcessed → InventoryUpdated → NotificationSent
```

Event payloads are versioned by `eventType`. A breaking change gets a new
type string (`order.created.v2`), not a mutation of the existing one.

## Architecture at a glance

```
src/
  modules/<bounded-context>/
    domain/          # entities, value objects, repository interfaces
    application/     # use cases (single execute(input) per file)
    infrastructure/  # Drizzle repositories, integrations
    interfaces/http/ # controllers, routes, validators
    index.ts         # composition root + public surface
  shared/            # technical primitives only — no business logic
  infrastructure/    # cross-cutting (db, cache, events, schema)
  app.ts             # express composition
  server.ts          # process bootstrap
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
4. `inventory.lockAndDeduct` issues `SELECT ... FOR UPDATE` in a
   deterministic (sorted-by-id) order to avoid deadlocks.
5. `orders` + `order_items` inserted.
6. `cart.status = 'converted'`.
7. `OrderCreated` written to `event_outbox` — atomic with the order insert.
8. Idempotency row finalised with the response body.

If any step fails the entire transaction rolls back, including the inventory
deduction and the outbox event.

### Caching
Product list and detail responses are cached in Redis (`product:list:*`,
`product:detail:*`). On product mutations, invalidate via
`redisCache.invalidatePrefix('product:')`.

### Pagination
Cursor-based, opaque base64url-encoded `(createdAt, id)` keyset cursor in
`@shared/types.ts`. No `OFFSET`.

### Security
- argon2id password hashing (mem 19 MiB).
- JWT access tokens (15 min TTL) + refresh tokens stored as SHA-256 hashes,
  rotating on every use; reuse of a revoked token revokes the entire family.
- Per-route rate limiting via Redis-backed `express-rate-limit`.
- Helmet, CORS, request-size limit, `x-request-id` correlation.
- All input validated with Zod at the controller boundary.

### Money
Always integer minor units. `Money` type alias in `@shared/types.ts`. Never
floats.

## Folder map

| Path | Purpose |
|------|---------|
| `src/modules/auth` | Register, login, refresh rotation, logout, JWT middleware |
| `src/modules/user` | User entity, repository |
| `src/modules/product` | Product + variants, list/detail with Redis caching |
| `src/modules/inventory` | Stock with `FOR UPDATE` deduction + ledger |
| `src/modules/cart` | Guest + authenticated carts, AddToCart, ApplyCoupon |
| `src/modules/discount` | Coupon validation and discount calculation |
| `src/modules/order` | CreateOrder (txn-safe + idempotent), state machine |
| `src/modules/payment` | Abstract `PaymentGateway`, mock provider |
| `src/shared` | Errors, response shape, logger, async-handler, env, types |
| `src/infrastructure/db` | Drizzle client, schema, migrate runner |
| `src/infrastructure/cache` | Redis client + cache port |
| `src/infrastructure/events` | Outbox publisher, in-memory/RabbitMQ bus, relay |

## Testing

```bash
pnpm test        # run all tests
pnpm test:cov    # with coverage report (80% gate)
```

Use cases get unit tests with in-memory repository fakes. Repositories get
integration tests against a real Postgres. See `.claude/rules/testing.md`
for the full testing contract.

## Common commands

```bash
pnpm dev           # dev server with hot reload
pnpm build         # compile TypeScript → dist/
pnpm typecheck     # full type check (run before committing)
pnpm lint          # ESLint
pnpm db:generate   # generate Drizzle migration from schema
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # Drizzle Studio at localhost:3000/studio
```

## Working with Claude on this project

Read `CLAUDE.md` and `.claude/`. The configuration is tuned for
token-efficient collaboration: assume the architecture, reference paths
instead of re-pasting, patch instead of rewriting. Use `/new-module` and
`/add-use-case` to scaffold consistently.
