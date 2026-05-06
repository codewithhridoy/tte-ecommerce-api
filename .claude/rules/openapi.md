# OpenAPI rules

## Always update after any HTTP-layer change

After adding, removing, or modifying any route, request shape, or response shape, update
`src/modules/<module>/interfaces/http/openapi.ts` in the same change.

What must stay in sync:
- New endpoints → new `registry.registerPath(...)` entry
- Removed endpoints → remove the corresponding registration
- Changed request body or query params → update the Zod schema in the openapi file
- Changed response shape → update the response Zod schema
- Changed status codes → update the `responses` map
- Changed auth requirements → update `security` field

## Source of truth

Zod schemas in the openapi file are the sole source of truth for the OpenAPI spec.
Do not duplicate them in YAML or any other format.
Reuse schemas from the use-case files where possible (import the Zod schema, call `.openapi()` on it).

## Schema naming

OpenAPI component names use PascalCase and are registered via `.openapi("Name")`:
- Request bodies: `<Action>Body` (e.g. `LoginBody`, `SendOtpBody`)
- Responses: `<Action>Response` (e.g. `SessionResponse`, `LoginPendingResponse`)

## Location

One `openapi.ts` file per module under `interfaces/http/`. It is imported (side-effect only)
by the module's `index.ts` or by `src/shared/http/openapi/registry.ts` aggregator.
