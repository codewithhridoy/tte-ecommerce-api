---
description: Scaffold a new bounded-context module following the project's strict layering
---

You are adding a new bounded context to the modular monolith. Name: `$ARGUMENTS`.

**Before writing code**, output a one-line plan answering:

1. Why this is a *new* bounded context vs. an extension of an existing module.
2. Which existing modules it will collaborate with, and via what mechanism
   (sync interface or domain event).
3. What its aggregate roots are.

Then scaffold this exact structure under `src/modules/$ARGUMENTS/`:

```
domain/{entities,value-objects,domain-services}/.gitkeep
application/use-cases/.gitkeep
infrastructure/{repositories,db}/.gitkeep
interfaces/http/{controllers,routes,validators}/.gitkeep
index.ts          # public module surface (composition root)
```

Rules:

- `index.ts` exports only the things other modules are allowed to depend on
  (typically: an application-service interface and a `register(app)` function
  that mounts routes).
- Do not add Drizzle tables to `infrastructure/db/schema/` until the user
  confirms the schema design.
- Do not add cross-module DB joins.
