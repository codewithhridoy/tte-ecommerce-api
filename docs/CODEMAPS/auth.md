# Auth module codemap

**Last updated:** 2026-05-06
**Bounded context:** `auth`
**Source:** `src/modules/auth/`
**Composition root:** `buildAuthModule()` in `src/modules/auth/index.ts`

This module owns authentication primitives (registration, login, refresh-token
rotation, logout) and out-of-band one-time-password (OTP) issuance and
verification. It does not own the user record itself — that lives in the
`user` module — it only consumes `UserRepository` through the public
`@modules/user/index` surface.

## Layout

```
src/modules/auth/
├── index.ts                              # buildAuthModule(); public surface
├── domain/
│   ├── entities/
│   │   ├── RefreshToken.ts
│   │   └── OtpToken.ts                   # { id, userId, codeHash, purpose, expiresAt, usedAt, ... }
│   ├── repositories/
│   │   ├── RefreshTokenRepository.ts
│   │   └── OtpTokenRepository.ts         # interface — DB access contract for OTPs
│   └── services/
│       ├── PasswordHasher.ts             # argon2id (mem 19 MiB, time 2, par 1)
│       ├── TokenService.ts               # JWT access + refresh issuance
│       └── OtpService.ts                 # generate / verify / resendAllowedAt
├── application/
│   └── use-cases/
│       ├── RegisterUser.ts
│       ├── LoginUser.ts
│       ├── RefreshSession.ts
│       ├── Logout.ts
│       ├── SendOtp.ts                    # + SendOtp.test.ts
│       └── VerifyOtp.ts                  # + VerifyOtp.test.ts
├── infrastructure/
│   └── repositories/
│       ├── DrizzleRefreshTokenRepository.ts
│       └── DrizzleOtpTokenRepository.ts
└── interfaces/
    └── http/
        ├── AuthController.ts             # register / login / refresh / logout
        ├── routes.ts
        ├── openapi.ts
        └── middleware/
            ├── authenticate.ts
            └── authorize.ts
```

## Public surface (`index.ts`)

```ts
export interface AuthModule {
  routes: Router
  tokenService: TokenService
  sendOtp: SendOtp
  verifyOtp: VerifyOtp
}

export const buildAuthModule = (): AuthModule => { /* ... */ }

export { authenticate, authorize }
export type { AuthenticatedPrincipal }
```

`sendOtp` and `verifyOtp` are exposed as **application-service objects** for
other modules to consume in-process (the architecture rules forbid reaching
into `application/use-cases/...` directly — go through this index).

## OTP feature

### Domain primitives

| Symbol | Path | Notes |
|--------|------|-------|
| `OtpToken` | `domain/entities/OtpToken.ts` | Immutable record persisted in `otp_tokens` |
| `OtpPurpose` | `domain/entities/OtpToken.ts` | `'email_verification' \| 'login' \| 'password_reset'` |
| `OtpTokenRepository` | `domain/repositories/OtpTokenRepository.ts` | `create`, `findLatestActive`, `findActiveByHash`, `markUsed`, `revokeAllForUser` |
| `OtpService` | `domain/services/OtpService.ts` | `generate()`, `verify()`, `resendAllowedAt()`, static `hash()` |

`OtpService` config (set in `buildAuthModule`):

| Field | Value | Meaning |
|-------|-------|---------|
| `codeLength` | `6` | Numeric code length, zero-padded |
| `ttlSeconds` | `600` | OTP valid for 10 minutes |
| `resendCooldownSeconds` | `60` | Earliest the same user+purpose may request another OTP |

Hashing: SHA-256 of the plaintext code. The plaintext is returned to the
caller exactly once (in `SendOtpOutput.code`); only the hash is stored.

### Use cases

`SendOtp` — `application/use-cases/SendOtp.ts`

```ts
input  : { userId: uuid, purpose: 'email_verification' | 'login' | 'password_reset' }
output : { code: string, expiresAt: Date, resendAllowedAt: Date }
errors : NotFoundError              // user missing or inactive
         PreconditionFailedError    // resend cooldown not yet elapsed
```

Behaviour:

1. Loads the user; rejects if missing or `!isActive`.
2. Looks up the latest active OTP for `(userId, purpose)`. If one exists and
   `resendAllowedAt > now`, throws `PreconditionFailedError` with the
   resend-allowed timestamp in the message.
3. Otherwise revokes any outstanding OTPs for `(userId, purpose)`
   (`revokeAllForUser`), then generates and persists a new OTP.
4. Returns the plaintext code (caller is responsible for delivering it via
   email / SMS — this module deliberately does not own delivery), the
   expiry, and the next allowed resend time.

`VerifyOtp` — `application/use-cases/VerifyOtp.ts`

```ts
input  : { userId: uuid, purpose: OtpPurpose, code: string (4..10 chars) }
output : { verified: true }
errors : NotFoundError              // user missing or inactive
         UnauthenticatedError       // code does not match an active OTP, or OTP expired
```

Behaviour:

1. Loads the user; rejects if missing or `!isActive`.
2. Hashes the submitted `code` via `OtpService.hash` and looks up an
   active (unused) OTP matching `(codeHash, userId, purpose)`.
3. Rejects with `UnauthenticatedError('Invalid or expired OTP')` if no
   match, or if `expiresAt < now`.
4. On success, marks the OTP `usedAt = now` (`markUsed`) and returns
   `{ verified: true }`. The same code cannot be reused.

### Persistence

Drizzle implementation: `infrastructure/repositories/DrizzleOtpTokenRepository.ts`.

Schema: `src/infrastructure/db/schema/users.ts`.

- Enum `otp_purpose` (`pgEnum`): `email_verification | login | password_reset`.
- Table `otp_tokens`:
  - `id` (uuid PK), `user_id` (uuid, FK `users.id` ON DELETE CASCADE),
    `code_hash` (text), `purpose` (`otp_purpose`), `expires_at` (timestamptz),
    `used_at` (timestamptz, nullable), plus standard `created_at` / `updated_at`.
  - Indexes: `otp_tokens_user_purpose_idx` on `(user_id, purpose)`,
    `otp_tokens_code_hash_unique` on `code_hash`.

Active-OTP semantics in the repository: `usedAt IS NULL AND expiresAt > now()`.
"Revoke" is implemented as a soft revoke by stamping `usedAt`.

### HTTP exposure

There are **no HTTP routes for OTP** at this time — `SendOtp` and `VerifyOtp`
are exposed only as in-process application services on `AuthModule`. The
existing `auth/interfaces/http` (`routes.ts`, `AuthController.ts`,
`openapi.ts`) cover register / login / refresh / logout only.

TODO: when an HTTP surface is added, register it under `/api/v1/auth/otp/*`
with the `authRateLimiter` and follow `.claude/rules/api-design.md`.

## Cross-module dependencies

| Imports from | Why |
|--------------|-----|
| `@modules/user/index` | `UserRepository`, `DrizzleUserRepository` |
| `@infra/db/client` | `db` (composition root only) |
| `@infra/db/schema` | `otpTokens`, `refreshTokens` (infrastructure layer only) |
| `@shared/env` | `ENV.JWT_*` |
| `@shared/errors` | `NotFoundError`, `UnauthenticatedError`, `PreconditionFailedError` |
| `@shared/id` | `newId()` |

This module is consumed by:

- `src/app.ts` — mounts `routes`, exposes `tokenService` to other modules
  needing JWT verification.
- Anything that needs to issue or check OTPs imports `sendOtp` / `verifyOtp`
  from `AuthModule` (caller-supplied delivery channel).

## Tests

| File | Kind |
|------|------|
| `application/use-cases/SendOtp.test.ts` | Unit — in-memory `OtpTokenRepository` fake |
| `application/use-cases/VerifyOtp.test.ts` | Unit — in-memory fake |

Per `.claude/rules/testing.md`: repository integration tests for
`DrizzleOtpTokenRepository` belong under `tests/integration/auth/` against
real Postgres. TODO: confirm coverage there once written.

## Related codemaps

- `user.md` — owns the `users` table and `UserRepository` consumed here. (TODO: write.)
- `../RUNBOOK.md` — refresh-token-family revocation runbook entry.
