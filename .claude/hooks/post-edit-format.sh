#!/usr/bin/env bash
# PostToolUse hook for Edit/Write.
# Auto-formats the changed file with Prettier if available.

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[[ -z "$file" || ! -f "$file" ]] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.json|*.md|*.yml|*.yaml) ;;
  *) exit 0 ;;
esac

root="$file"
while [[ "$root" != "/" && ! -f "$root/package.json" ]]; do
  root=$(dirname "$root")
done
[[ -f "$root/package.json" && -d "$root/node_modules/prettier" ]] || exit 0

cd "$root"
pnpm exec prettier --write --log-level warn "$file" >/dev/null 2>&1 || true

exit 0
