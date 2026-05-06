#!/usr/bin/env bash
# PostToolUse hook for Edit/Write on .ts files.
#
# Runs ESLint on the edited file and surfaces errors as warnings.
# Soft: never blocks (exit 0). Claude sees the output and can self-correct.

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[[ -z "$file" ]] && exit 0
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
[[ -f "$file" ]] || exit 0

# Skip generated / build artefacts.
case "$file" in
  */dist/*|*/node_modules/*|*/coverage/*) exit 0 ;;
esac

root="$file"
while [[ "$root" != "/" && ! -f "$root/package.json" ]]; do
  root=$(dirname "$root")
done
[[ -f "$root/package.json" && -d "$root/node_modules" ]] || exit 0

cd "$root"

if ! command -v pnpm >/dev/null 2>&1; then
  exit 0
fi

if output=$(pnpm exec eslint --max-warnings=0 "$file" 2>&1); then
  exit 0
fi

{
  printf 'ESLint issues in %s:\n\n' "$file"
  printf '%s\n' "$output" | head -n 20
  printf '\n(Run `pnpm lint` for full output.)\n'
} >&2

exit 0
