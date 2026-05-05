#!/usr/bin/env bash
# PostToolUse hook for Edit/Write on .ts files.
#
# Runs `tsc --noEmit` on the project. Soft warning: shows errors to Claude
# but never blocks (exit 0). The /build-fix slash command exists for fixing.
#
# Skips if pnpm / tsc isn't installed (early bootstrap).

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[[ -z "$file" ]] && exit 0
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Resolve project root from the file path.
root="$file"
while [[ "$root" != "/" && ! -f "$root/package.json" ]]; do
  root=$(dirname "$root")
done
[[ -f "$root/package.json" ]] || exit 0

if [[ ! -d "$root/node_modules" ]]; then
  exit 0
fi

cd "$root"
if ! command -v pnpm >/dev/null 2>&1; then
  exit 0
fi

# Soft check: use tsc directly to avoid noisy npm script output.
if output=$(pnpm exec tsc --noEmit 2>&1); then
  exit 0
fi

# Show first ~30 lines of error output to Claude.
{
  printf 'Typecheck has errors after this edit:\n\n'
  printf '%s\n' "$output" | head -n 30
  printf '\n(Run `pnpm typecheck` for full output, or use the build-error-resolver agent.)\n'
} >&2

exit 0
