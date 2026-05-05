#!/usr/bin/env bash
# PreToolUse hook for Bash.
#
# Adds project-specific deny rules on top of the global allow/deny list.
# Blocks:
#   - Migrations applied to anything that looks like production.
#   - `drizzle-kit push` (auto-sync) — we use generate + migrate.
#   - Force pushes to main / master / release branches.
#   - psql DROP / TRUNCATE.
#   - `rm -rf src` and other catastrophic deletes.

set -euo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[[ -z "$cmd" ]] && exit 0

block() {
  printf 'Blocked: %s\n' "$1" >&2
  printf '  command: %s\n' "$cmd" >&2
  printf '\nIf you genuinely need this, ask the user explicitly first.\n' >&2
  exit 2
}

# auto-sync banned
if printf '%s' "$cmd" | grep -Eq "drizzle-kit\s+push"; then
  block "drizzle-kit push (auto-sync) is banned — use db:generate + db:migrate"
fi

# DB URL pointing at prod
if printf '%s' "$cmd" | grep -Eqi "DATABASE_URL=.*(prod|production)"; then
  block "command targets a production-like DATABASE_URL"
fi

# psql DROP / TRUNCATE
if printf '%s' "$cmd" | grep -Eqi "psql.*-c\s+['\"]?\s*(DROP|TRUNCATE)\s"; then
  block "psql DROP/TRUNCATE — destructive, requires explicit user authorisation"
fi

# Force push to protected branches
if printf '%s' "$cmd" | grep -Eq "git\s+push\s+(--force|-f)\b.*\b(main|master|release/.+)\b"; then
  block "force push to a protected branch"
fi

# rm -rf on protected paths
if printf '%s' "$cmd" | grep -Eq "rm\s+-rf\s+(/|\.|src|.claude|node_modules/.*|tests)\b"; then
  # allow rm -rf node_modules itself
  if ! printf '%s' "$cmd" | grep -Eq "rm\s+-rf\s+node_modules\s*$"; then
    block "rm -rf on a protected path"
  fi
fi

# Skipping verification on commits
if printf '%s' "$cmd" | grep -Eq "git\s+commit\b.*--no-verify"; then
  block "git commit --no-verify bypasses hooks — fix the underlying issue instead"
fi

exit 0
