# Git workflow rules

## Branches

- `main` is protected. PRs only.
- Feature branches: `feat/<short-description>`, `fix/<short-description>`,
  `chore/...`, `refactor/...`.
- One bounded context per branch. Refactors that touch every module are
  split into N PRs whenever possible.

## Commits

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
  `chore:`, `perf:`, `ci:`.
- Subject ≤ 72 chars, imperative mood ("add X" not "added X").
- Body explains *why*, not *what* — the diff is the *what*.
- Reference issues: `Closes #123`.

## What does NOT belong in a commit

- Generated files (`dist/`, coverage).
- IDE settings (already gitignored).
- `console.log`, `// TODO: remove me`, debug-only changes.
- Multiple unrelated changes ("fixed lint and added new feature").

## Pull requests

- PR title mirrors the conventional commit format.
- PR description includes: summary, motivation, test plan, screenshots
  (for UI), migration notes (for DB).
- Keep PRs under ~400 lines diff when possible. Bigger? Split it.
- Migrations get their own PR or are explicitly called out in the
  description.

## Pre-merge checks

1. `pnpm typecheck` — green.
2. `pnpm lint` — green.
3. `pnpm test` — green, coverage gate met.
4. CI passing.
5. Reviewer sign-off.

## Forbidden

- `git push --force` to `main` or any shared branch.
- `git commit --no-verify` to bypass hooks (unless explicitly authorised).
- Amending or rebasing already-pushed shared branches.
- Committing `.env` or anything with secrets.
