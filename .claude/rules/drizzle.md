# Drizzle / Postgres rules

## Schema

- All tables live under `src/infrastructure/db/schema/`, one file per
  bounded context.
- Every table has `id` (uuid PK, default random), `created_at`, `updated_at`
  via `timestamps` from `_helpers.ts`.
- Every table that is queried by anything other than `id` has an index
  for that access pattern. No "table scan by default."
- Foreign keys are explicit. `onDelete` is always set deliberately —
  `cascade` for owned children, `restrict` for referenced data, `set null`
  for soft-link.
- Use `check()` constraints for invariants the application can't enforce
  alone (e.g. `inventory.on_hand >= 0`).

## Money columns

- `*_minor INTEGER NOT NULL`. Never `numeric`, never `real`.
- Currency is a separate `varchar(3)` column.

## Enums

- Postgres enums via `pgEnum`. New value? It's a migration. Don't reuse
  existing enum slots for different meanings.

## Migrations

- **Never** auto-sync. `drizzle-kit generate` produces a migration file;
  review it before applying. Treat migrations as code (PR-reviewed).
- Backwards-compatible migrations only on the hot path:
  1. Add column nullable / with default → deploy code.
  2. Backfill.
  3. Drop nullability or default.
- Never `DROP COLUMN` in the same release that stops writing it. Two
  releases minimum.
- Long-running operations on big tables (`ALTER TYPE`, `CREATE INDEX`)
  must use `CONCURRENTLY` or a maintenance window. Flag this in the PR.

## Query patterns

- Repository implementations live in `infrastructure/repositories/`.
- N+1 is forbidden. If you `.findById()` in a loop, you have a bug — load
  the whole set with `inArray` and group in memory.
- Cursor pagination uses `(created_at, id)` keyset, opaque base64url cursor
  via `@shared/types`. No `OFFSET`.
- Selects that need to mutate same row → `SELECT ... FOR UPDATE` inside a
  transaction. Acquire locks in deterministic order (sort by primary key)
  to avoid deadlocks.

## Type safety

- Repository methods return domain entities, not Drizzle row types. The
  `toX()` mapper is mandatory.
- Drizzle row types only leak inside `infrastructure/repositories/`.
- `noUncheckedIndexedAccess` is on — `const [row] = await ...` produces
  `Row | undefined`. Handle both.
