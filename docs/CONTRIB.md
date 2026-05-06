# Contributing

**Last updated:** 2026-05-07

This document covers the developer workflow for `tte-ecommerce-api`. For
architectural rules, read the project root `CLAUDE.md` and
`.claude/rules/*.md` first — those are normative. This document is purely
operational.

## Prerequisites

- Node.js >= 20.11 (see `engines` in `package.json`)
- `pnpm` (workspace declared via `pnpm-workspace.yaml`)
- Docker >= 24 with Docker Compose v2
- GNU Make (for the `make` targets)

## Environment setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the env template and fill in secrets:

   ```bash
   cp .env.example .env
   ```

   Required variables (see `.env.example` for the canonical list):

   | Variable | Purpose |
   |----------|---------|
   | `NODE_ENV` | `development` / `production` |
   | `PORT` | HTTP port (default `3000`) |
   | `LOG_LEVEL` | `pino` log level |
   | `DATABASE_URL` | Postgres connection string |
   | `DATABASE_POOL_MAX` | `pg` pool size |
   | `REDIS_URL` | Redis connection string (rate-limit + cache) |
   | `JWT_ACCESS_SECRET` | >= 32 random bytes in prod, >= 16 in dev |
   | `JWT_REFRESH_SECRET` | >= 32 random bytes in prod, >= 16 in dev |
   | `JWT_ACCESS_TTL` | Access token TTL (seconds, default 900) |
   | `JWT_REFRESH_TTL` | Refresh token TTL (seconds, default 2592000) |
   | `RATE_LIMIT_WINDOW_MS` | Default rate-limit window |
   | `RATE_LIMIT_MAX` | Default per-window quota |
   | `EVENT_BUS_DRIVER` | `outbox` (current) or `rabbitmq` |
   | `RABBITMQ_URL` | AMQP URL when `EVENT_BUS_DRIVER=rabbitmq` |
   | `PAYMENT_PROVIDER` | `mock` (current default) |
   | `EMAIL_PROVIDER` | `console` (dev — logs OTP to stdout) or `resend` (production) |
   | `EMAIL_FROM` | From address for OTP emails (e.g. `noreply@yourdomain.com`) |
   | `RESEND_API_KEY` | Required when `EMAIL_PROVIDER=resend`. Get from resend.com |

   Generate JWT secrets with `openssl rand -hex 32`.

3. Start infra (Postgres + Redis + RabbitMQ) — pick one:

   ```bash
   # Option A: full dev stack (app runs in container with hot reload)
   make up

   # Option B: only the infra, run the app on the host
   docker compose up -d postgres redis rabbitmq
   ```

4. Apply migrations:

   ```bash
   pnpm db:migrate           # host
   make db-migrate           # container
   ```

5. Run the app (host mode):

   ```bash
   pnpm dev
   ```

   Health check: `GET http://localhost:3000/health`. API root: `/api/v1`.

## Available scripts

From `package.json`:

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Start dev server with `tsx watch` and `--env-file=.env` |
| `pnpm build` | Bundle to `dist/` via `tsup` |
| `pnpm start` | Run the built `dist/server.js` |
| `pnpm typecheck` | `tsc --noEmit` — run before declaring work done |
| `pnpm lint` | `eslint . --ext .ts` |
| `pnpm test` | Vitest, single run |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:cov` | Vitest with coverage (80% gate per `vitest.config.ts`) |
| `pnpm db:generate` | `drizzle-kit generate` — emit a migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations via `src/infrastructure/db/migrate.ts` |
| `pnpm db:studio` | Drizzle Studio |

`make help` lists Docker-oriented targets (`up`, `down`, `logs`, `shell`,
`db-migrate`, `prod-up`, `prod-build`, etc.). See `Makefile` for the
canonical list.

## Dev workflow

1. **Branch.** `feat/<short-description>`, `fix/...`, `refactor/...`,
   `chore/...`. One bounded context per branch where feasible
   (see `.claude/rules/git.md`).
2. **Plan.** For non-trivial work, sketch the layering (`domain →
   application → infrastructure → interfaces`) before coding. Cross-module
   work goes through application-service interfaces or domain events — never
   reach into another module's `infrastructure/`.
3. **TDD.**
   - Use-case test first (in-memory repository fakes), see
     `src/modules/auth/application/use-cases/SendOtp.test.ts` and
     `VerifyOtp.test.ts` for the canonical shape.
   - Implement until green.
   - Add the repository implementation + integration test under
     `tests/integration/<module>/`.
   - Wire the controller and add an HTTP integration test under
     `tests/integration/http/`.
4. **Schema changes.** Edit a file under `src/infrastructure/db/schema/`,
   then `pnpm db:generate`, review the emitted SQL under
   `src/infrastructure/db/migrations/`, commit it, then `pnpm db:migrate`.
   Never auto-sync.
5. **Type-check + lint + test before pushing.**

   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

6. **Commit.** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`,
   `test:`, `chore:`, `perf:`, `ci:`). Subject <= 72 chars, imperative mood.
   See `.claude/rules/git.md` for the full contract.

## Testing procedures

| Layer | Test type | Location |
|-------|-----------|----------|
| Domain entities, value objects, pure functions | Unit (colocated) | `*.test.ts` next to source |
| Use cases | Unit with in-memory fakes | colocated next to use case |
| Drizzle repositories | Integration vs real Postgres | `tests/integration/<module>/` |
| HTTP routes (happy + error) | Integration with supertest | `tests/integration/http/` |
| Critical user flows (signup -> cart -> order -> pay) | E2E | `tests/e2e/` |

Coverage gate: 80% lines/functions/statements, 75% branches
(see `vitest.config.ts`). CI fails below.

Run targeted tests:

```bash
pnpm test src/modules/auth                 # one module
pnpm test SendOtp                          # by name pattern
pnpm test:watch                            # iterate
```

### Fakes vs mocks

Prefer in-memory **fakes** (real implementations of the repository
interface backed by a `Map`). `vi.fn()` mocks for use-case tests are a
code smell — they decouple the test from the real interface contract.

### Determinism

- No `Date.now()` in assertions — inject a clock or freeze time with
  `vi.useFakeTimers`.
- No real network, no real time, no real randomness in unit tests.
- Tests must pass run alone or in any order.

## Code style highlights

Full rules in `.claude/rules/coding-style.md` (global) and
`.claude/rules/architecture.md` (project). Highlights:

- ESM, NodeNext. No CommonJS `require`.
- `verbatimModuleSyntax: true` — `import type { ... }` for type-only.
- `noUncheckedIndexedAccess: true` — handle `T | undefined` from arrays.
- Throw subclasses of `AppError` from `@shared/errors`. Never throw bare
  `Error` from a use case or controller.
- Money: integer minor units. `Money` type from `@shared/types`. No floats.
- IDs: `newId()` from `@shared/id` (uuid v7). Never expose internal numeric IDs.

## Documentation

- `README.md` — project overview, quick start, Docker workflow.
- `INFRASTRUCTURE_SETUP.md` — first-run infra checklist.
- `docs/CONTRIB.md` — this file.
- `docs/RUNBOOK.md` — operational runbook (deploys, migrations, rollback).
- `docs/CODEMAPS/` — bounded-context maps. Start at
  `docs/CODEMAPS/INDEX.md`; the `auth` module map covers the OTP feature
  (`SendOtp` / `VerifyOtp`, `OtpService`, `otp_tokens` schema).
- `CLAUDE.md` + `.claude/rules/*.md` — normative rules for humans and Claude.
