# Runbook

**Last updated:** 2026-05-06

Operational procedures for deploying, migrating, and recovering
`tte-ecommerce-api`. For developer workflow see `docs/CONTRIB.md`.

## Stacks

There are two compose stacks:

- `docker-compose.yml` — dev. App container bind-mounts the project for
  `tsx watch` hot reload; Postgres/Redis/RabbitMQ exposed on the host.
- `docker-compose.prod.yml` — production. App is the only service exposed
  on the host (port 3000); infra services are internal only.

`make help` lists every target.

## Deployment

### Production image

```bash
make prod-build      # docker compose -f docker-compose.prod.yml build app
make prod-up         # start the full prod stack detached
make prod-logs       # tail
make prod-down       # stop
```

Required env vars (in addition to `.env.example`):

```
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
REDIS_PASSWORD=...
RABBITMQ_USER=...
RABBITMQ_PASS=...
```

JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) must be at least
32 random bytes in production (`openssl rand -hex 32`). The env schema
enforces a 16-byte sanity-check minimum.

A reverse proxy (nginx, Caddy, etc.) terminates TLS in front of port 3000.
TODO: document the reference nginx/Caddy config the platform team uses.

### Build artifact

`pnpm build` produces `dist/` via `tsup` (see `tsup.config.ts`). The prod
container runs `node dist/server.js` (`pnpm start`). No `devDependencies`
are installed in the production image.

### Health check

`GET /health` — returns 200 when the process is up. TODO: document the exact
shape if the platform team needs liveness/readiness split.

## Running migrations

Migrations live in `src/infrastructure/db/migrations/` and are emitted by
`drizzle-kit` from the schema files in `src/infrastructure/db/schema/`.
**Never auto-sync.** Migrations are PR-reviewed code.

### Generate (developer machine)

```bash
pnpm db:generate
```

Review the emitted SQL file under `src/infrastructure/db/migrations/`,
commit it together with the schema change.

### Apply

| Environment | Command |
|-------------|---------|
| Host (dev) | `pnpm db:migrate` |
| Dev container | `make db-migrate` |
| Prod container | `make prod-db-migrate` (runs `node dist/infrastructure/db/migrate.js`) |

The runner is `src/infrastructure/db/migrate.ts`.

### Migration policy

Backwards-compatible migrations only on the hot path
(see `.claude/rules/drizzle.md`):

1. Add column nullable / with default -> deploy code.
2. Backfill.
3. Drop nullability or default in a later release.

Never `DROP COLUMN` in the same release that stops writing it. Two releases
minimum. Long-running operations on big tables (`ALTER TYPE`,
`CREATE INDEX`) must use `CONCURRENTLY` or a maintenance window — flag this
in the PR description.

## Common issues

### App can't reach Postgres / Redis / RabbitMQ

Verify the infra is up and accepting connections:

```bash
docker compose ps
docker compose exec postgres psql -U postgres -d tte_ecommerce -c "\dt"
docker compose exec redis redis-cli ping
docker compose exec rabbitmq rabbitmq-diagnostics -q ping
```

Check `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL` in `.env`. In dev the
host ports are 5432 / 6379 / 5672 (per `INFRASTRUCTURE_SETUP.md`); the
project's `docker-compose.yml` may map alternative host ports — see the
README's "Service ports on the host (dev)" table. Inside the dev app
container, connect to service names (`postgres`, `redis`, `rabbitmq`),
not `localhost`.

### Migrations fail mid-deploy

The migration runner is transactional per file. If a migration fails:

1. Capture the error from the migrate command.
2. Do not patch the existing migration file. Emit a corrective migration
   (`pnpm db:generate`) and ship it as a new SQL file.
3. If the failure left partial state that the corrective migration can't
   reach, restore from the most recent backup (see Rollback).

### Refresh-token reuse alert

A reused-after-revocation refresh token revokes the entire family
(see `.claude/rules/security.md`). If a customer reports forced logout
across all sessions, check the refresh-token table for the user's
`familyId` group — a rotation attack is the most likely cause.

### Order creation fails with `412 Precondition Failed`

Insufficient stock at `inventory.lockAndDeduct` time. Expected behaviour;
no operator action. If the user retries with the same `Idempotency-Key`,
the same 412 is replayed (see `CreateOrder` in `src/modules/order`).

### Order creation `409 Conflict`

`Idempotency-Key` was reused with a different request body. Client bug.
Have the client either reuse the *exact* original body or generate a new
key.

### Outbox not draining

`startOutboxRelay` is started from `server.ts`. If `event_outbox` rows
accumulate:

1. Check that the app process is healthy (the relay runs in-process).
2. Confirm `EVENT_BUS_DRIVER` matches the deployed bus
   (`outbox` keeps everything in Postgres + in-memory; `rabbitmq` requires
   a reachable `RABBITMQ_URL`).
3. Inspect the RabbitMQ management UI at port 15672 for stuck consumers
   when on the `rabbitmq` driver.

TODO: document the exact metric / alert for "outbox lag" once one is in
place.

### Rate-limit storm

Rate limits are Redis-backed (`express-rate-limit` + `rate-limit-redis`).
If Redis is down the limiter degrades — see `src/shared/http/middleware/`
for the configured fallback. TODO: document the fallback behaviour
explicitly once verified against the source.

## Rollback

### Application rollback

Re-deploy the previous container image tag:

```bash
# adjust image tag / digest to the previous good build
make prod-down
# pull / set the previous tag
make prod-up
```

If the previous release introduced a forward-only schema change, do **not**
roll the app back without first considering the schema. Forward-fix is
preferred over backward-incompatible DB rollbacks.

### Database rollback

There is currently **no down-migration tooling** in this project — Drizzle
emits forward-only SQL. Rollback strategies, in order of preference:

1. **Forward fix.** Emit a new migration that reverts or corrects the
   change.
2. **Restore from backup.** Restore the most recent point-in-time snapshot.
   TODO: document the platform-specific backup/PITR procedure
   (managed Postgres provider, `pg_dump` cron, etc.).

Never hand-edit a migration file that has already been applied to a shared
environment.

### Cleanup commands

```bash
make clean            # remove containers + local images, keep volumes
make clean-volumes    # remove containers + images + named volumes (DATA LOSS)
```

Use `clean-volumes` only on dev machines — it drops the Postgres data
directory.

## Open items / TODO

- Document the production reverse-proxy reference config (nginx / Caddy).
- Document the `/health` payload contract for k8s liveness/readiness.
- Document the backup + PITR procedure for the prod Postgres deployment.
- Document the metric / alert for outbox-relay lag.
- Verify and document the rate-limiter fallback behaviour when Redis is
  unreachable.
