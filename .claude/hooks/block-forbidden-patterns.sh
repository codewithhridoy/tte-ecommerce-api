#!/usr/bin/env bash
# PreToolUse hook for Edit/Write.
#
# Blocks code patterns the project rules forbid:
#   - Hardcoded secrets / JWT secrets / DB URLs.
#   - `process.env.X` outside @shared/env (and a few allow-listed bootstrap files).
#   - Float arithmetic on *_minor money values.
#   - `as any` on use cases / repositories.
#   - `eval(` / `new Function(`.

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
content=$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

[[ -z "$file" || -z "$content" ]] && exit 0
case "$file" in
  */src/*.ts) ;;
  *) exit 0 ;;
esac

violations=()

# Hardcoded secret-ish patterns
if printf '%s' "$content" | grep -Eqn "(JWT_SECRET|SECRET|PASSWORD|API_KEY)\s*[:=]\s*['\"][A-Za-z0-9+/=_-]{16,}['\"]"; then
  matches=$(printf '%s' "$content" | grep -En "(JWT_SECRET|SECRET|PASSWORD|API_KEY)\s*[:=]\s*['\"][A-Za-z0-9+/=_-]{16,}['\"]")
  violations+=("[BLOCK] $file: looks like a hardcoded secret — use loadEnv() from @shared/env")
  while IFS= read -r line; do violations+=("          $line"); done <<<"$matches"
fi

if printf '%s' "$content" | grep -Eqn "postgres://[^:]+:[^@\s]+@"; then
  violations+=("[BLOCK] $file: hardcoded Postgres URL with credentials")
fi

# process.env outside the allowed paths
case "$file" in
  */src/shared/env.ts|*/src/infrastructure/db/migrate.ts|*/drizzle.config.ts|*/tests/setup*.ts)
    : # allowed
    ;;
  *)
    if printf '%s' "$content" | grep -Eqn "process\.env\.[A-Z_]+"; then
      matches=$(printf '%s' "$content" | grep -En "process\.env\.[A-Z_]+")
      violations+=("[BLOCK] $file: process.env access outside @shared/env — use loadEnv()")
      while IFS= read -r line; do violations+=("          $line"); done <<<"$matches"
    fi
    ;;
esac

# Float arithmetic on *_minor variables — heuristic.
# Catch: someVarMinor * 0.X  OR  Number('...') * X  on a *_minor field.
if printf '%s' "$content" | grep -Eqn "[A-Za-z_]+Minor\s*[*/]\s*[0-9]+\.[0-9]"; then
  matches=$(printf '%s' "$content" | grep -En "[A-Za-z_]+Minor\s*[*/]\s*[0-9]+\.[0-9]")
  violations+=("[BLOCK] $file: float arithmetic on *Minor money values — use integer math (see rules/money.md)")
  while IFS= read -r line; do violations+=("          $line"); done <<<"$matches"
fi

# `as any`
if printf '%s' "$content" | grep -Eqn "\bas\s+any\b"; then
  matches=$(printf '%s' "$content" | grep -En "\bas\s+any\b")
  violations+=("[WARN]  $file: 'as any' undermines type safety — narrow with a guard or define the type")
  while IFS= read -r line; do violations+=("          $line"); done <<<"$matches"
fi

# eval / new Function
if printf '%s' "$content" | grep -Eqn "\b(eval|new\s+Function)\s*\("; then
  violations+=("[BLOCK] $file: eval / new Function are forbidden")
fi

# bare Error throw inside application/
if [[ "$file" == */application/* ]]; then
  if printf '%s' "$content" | grep -Eqn "throw\s+new\s+Error\s*\("; then
    matches=$(printf '%s' "$content" | grep -En "throw\s+new\s+Error\s*\(")
    violations+=("[WARN]  $file: throw an AppError subclass from @shared/errors instead of bare Error")
    while IFS= read -r line; do violations+=("          $line"); done <<<"$matches"
  fi
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  printf 'Forbidden patterns detected:\n\n' >&2
  printf '%s\n' "${violations[@]}" >&2
  if printf '%s\n' "${violations[@]}" | grep -q '^\[BLOCK\]'; then
    printf '\nThis edit is blocked. See .claude/rules/security.md and rules/money.md.\n' >&2
    exit 2
  fi
fi

exit 0
