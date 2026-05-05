---
description: Add a use case to an existing module following clean architecture
---

Add use case `$ARGUMENTS` (format: `<module>/<UseCaseName>`).

Steps — do *only* these, in order:

1. Read the module's `domain/` folder; list the entities and repository
   interfaces you will use. If any are missing, stop and ask.
2. Add `application/use-cases/<UseCaseName>.ts` exporting:
   - `<UseCaseName>Input` (Zod schema **and** inferred TS type)
   - `<UseCaseName>Output` (TS type)
   - `class <UseCaseName>` with constructor DI of repository interfaces and
     a single `execute(input): Promise<Output>` method.
3. Add a unit test `application/use-cases/<UseCaseName>.test.ts` using
   in-memory fakes of the repositories.
4. Wire it into the module's composition root (`index.ts`) — do *not* yet
   expose an HTTP route unless the user asks.

Do not touch other modules. Do not invent new domain primitives without
adding them under `domain/` first.
