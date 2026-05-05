# Testing rules

## What gets which kind of test

| Layer | Test type | Where |
|-------|-----------|-------|
| Domain entities, value objects, pure functions | Unit | colocated `*.test.ts` |
| Use cases | Unit with in-memory fakes of repositories | colocated next to use case |
| Drizzle repositories | Integration against real Postgres | `tests/integration/<module>/` |
| HTTP routes (happy + error paths) | Integration with supertest + real DB | `tests/integration/http/` |
| Critical user flows (signup → add to cart → order → pay) | E2E | `tests/e2e/` |

## TDD

For new features:
1. Write the use-case test first with fake repos.
2. Implement the use case until green.
3. Add the repository implementation + integration test.
4. Wire the controller + integration test for the route.

## Coverage gate

Threshold in `vitest.config.ts`: 80% lines/functions/statements, 75%
branches. CI fails below. Coverage exclusions are limited to
`index.ts` (composition roots), `server.ts`, schema, and migrations —
nothing else.

## Fakes vs mocks

- Prefer in-memory **fakes** (real implementations of the interface that
  use a Map). Mocks (vi.fn returning canned values) are a code smell for
  use-case tests because they decouple from the real interface contract.

## Test data

- Builders / factories live in `tests/factories/<entity>.ts`. Each factory
  returns a minimal valid object with overrides.
- Don't share mutable test data between tests. Each test builds its own.

## Database tests

- Use a dedicated test database per worker (vitest pool) or testcontainers.
- Truncate-and-reseed between tests, not migrate-from-scratch.
- A test that mutates the DB and doesn't clean up is broken — fix it,
  don't `.skip()` it.

## Determinism

- No `Date.now()` in assertions — inject a clock or freeze time with
  `vi.useFakeTimers`.
- No real network, no real time, no real randomness in unit tests.
- Order-dependent tests are forbidden. Tests must pass when run alone or
  in any order.

## What NOT to test

- Drizzle itself (it's a dependency).
- Express middleware behaviour that's purely framework-provided.
- Generated code (migrations, OpenAPI clients).
- Trivial getters / one-line passthroughs.
