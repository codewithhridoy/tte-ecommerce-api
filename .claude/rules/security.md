# Security rules

## Secrets

- All secrets come from env vars, parsed once via `loadEnv()` in
  `@shared/env`. Never read `process.env` directly anywhere else.
- `.env` is gitignored. `.env.example` documents the shape. Never commit
  real secrets.
- JWT secrets must be at least 32 random bytes in production. The schema
  enforces a minimum length of 16 bytes for sanity-check.

## Authentication

- Passwords: argon2id, mem 19 MiB, time 2, parallelism 1. Defined in
  `@modules/auth/domain/services/PasswordHasher`. Never use bcrypt or
  PBKDF2 here.
- Access tokens: short-TTL JWT, 15 minutes default.
- Refresh tokens: 48-byte random, stored as SHA-256 hash, grouped by
  `familyId`. **Reuse of a revoked token revokes the entire family.** This
  is the only correct way — do not loosen it.
- Logout revokes the family.

## Authorisation

- RBAC via `authorize('admin', 'staff')` middleware from
  `@modules/auth`. Roles: `customer`, `staff`, `admin`.
- Resource-level checks (e.g. "user X can read order Y") live in the use
  case, not in middleware. Middleware only checks role.

## Input validation

- Every controller validates input with a Zod schema *before* invoking the
  use case. Zod schemas live alongside the use case (so the use case owns
  its contract).
- Reject unknown fields by default? Yes — use `.strict()` on top-level
  request schemas where possible.

## Output

- Never return `passwordHash`, refresh-token raw values, or other secrets.
  Repository methods returning user objects must strip secrets in the
  mapper (see `User` vs `UserWithSecret`).
- Error messages must not leak whether an account exists during login —
  always return "Invalid credentials".

## SQL / injection

- Drizzle parameterises everything. If you find yourself writing raw
  `db.execute(sql.raw(...))` with user input, stop and fix it.

## Rate limiting

- All write endpoints are rate-limited via Redis-backed
  `express-rate-limit`. `/auth/*` has its own stricter limiter.
- New auth endpoint? Wire it through `authRateLimiter`.

## CSRF

- API is stateless (Bearer token). CSRF protection only required if cookies
  carrying credentials are introduced — not currently the case.

## CORS

- `origin: true` is dev-only. Production must use an explicit allowlist
  via env var. (TODO before launch.)

## Money & PII in logs

- `pino` is configured with redact paths for `authorization`, `cookie`,
  `password*`, `token*`, `refreshToken`. **Do not log raw request bodies**
  on auth or payment routes.
