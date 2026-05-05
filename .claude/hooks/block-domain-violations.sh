#!/usr/bin/env bash
# PreToolUse hook for Edit/Write.
#
# Blocks edits that introduce architectural rot:
#   - Express / Drizzle / pg / ioredis / jsonwebtoken / argon2 / zod imports
#     into a `domain/` file.
#   - Direct `@infra/db` imports into a controller (`interfaces/http/`).
#   - `@modules/<name>/infrastructure/...` imports from outside that module.
#   - `new DrizzleXRepository(` inside a use case.
#
# Reads tool input JSON on stdin. Exit 2 to block; stderr is shown to Claude.

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
content=$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Skip if no file path or content (e.g. read-only ops).
[[ -z "$file" || -z "$content" ]] && exit 0

# Only inspect TS sources under src/.
case "$file" in
  */src/*.ts) ;;
  *) exit 0 ;;
esac

violations=()

# 1. domain/ purity
if [[ "$file" == */domain/* ]]; then
  if printf '%s' "$content" | grep -Eqn "^\s*import .*(from\s+['\"](express|drizzle-orm|drizzle-orm/.*|pg|ioredis|jsonwebtoken|argon2|zod|@infra/.*|express-rate-limit|helmet)['\"])"; then
    matches=$(printf '%s' "$content" | grep -En "^\s*import .*(from\s+['\"](express|drizzle-orm|drizzle-orm/.*|pg|ioredis|jsonwebtoken|argon2|zod|@infra/.*|express-rate-limit|helmet)['\"])")
    violations+=("[BLOCK] $file: domain/ layer must not import frameworks/infrastructure")
    violations+=("        offending lines:")
    while IFS= read -r line; do violations+=("          $line"); done <<<"$matches"
  fi
fi

# 2. controllers must not touch DB / repos directly
if [[ "$file" == */interfaces/http/* ]]; then
  if printf '%s' "$content" | grep -Eqn "^\s*import .*from\s+['\"]@infra/db"; then
    violations+=("[BLOCK] $file: controllers must not import @infra/db — depend on a use case")
  fi
  if printf '%s' "$content" | grep -Eqn "^\s*import .*Repository.*from\s+['\"]\.\.+/infrastructure/"; then
    violations+=("[BLOCK] $file: controllers must not import repository implementations")
  fi
fi

# 3. cross-module reach-past
if [[ "$file" =~ src/modules/([^/]+)/ ]]; then
  current_module="${BASH_REMATCH[1]}"
  bad=$(printf '%s' "$content" \
    | grep -En "^\s*import .*from\s+['\"]@modules/([^/'\"]+)/(infrastructure|domain/entities|domain/repositories)/" \
    | grep -Ev "@modules/${current_module}/" || true)
  if [[ -n "$bad" ]]; then
    violations+=("[BLOCK] $file: cross-module imports must come through @modules/<name>/index.ts")
    while IFS= read -r line; do violations+=("          $line"); done <<<"$bad"
  fi
fi

# 4. use case constructing a concrete repo
if [[ "$file" == */application/use-cases/* ]]; then
  if printf '%s' "$content" | grep -Eqn "new\s+Drizzle[A-Za-z]+Repository\s*\("; then
    violations+=("[BLOCK] $file: use cases must receive repositories via DI, not construct them")
  fi
  if printf '%s' "$content" | grep -Eqn "^\s*import .*from\s+['\"]@infra/db/client"; then
    # Allowed to import db ONLY for db.transaction usage. Permit but warn if no .transaction.
    if ! printf '%s' "$content" | grep -q "db\.transaction"; then
      violations+=("[WARN]  $file: use case imports @infra/db/client but no db.transaction — should depend on repos only")
    fi
  fi
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  printf 'Architectural violations detected (see .claude/rules/architecture.md):\n\n' >&2
  printf '%s\n' "${violations[@]}" >&2
  printf '\nFix the violations above, or update .claude/rules/architecture.md if the rule is wrong.\n' >&2
  # BLOCK only if any [BLOCK] entry exists.
  if printf '%s\n' "${violations[@]}" | grep -q '^\[BLOCK\]'; then
    exit 2
  fi
fi

exit 0
