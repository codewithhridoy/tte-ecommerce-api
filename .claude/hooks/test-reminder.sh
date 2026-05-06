#!/usr/bin/env bash
# PostToolUse hook for Edit/Write.
#
# When a use-case file is edited, checks whether a colocated *.test.ts exists.
# If not, surfaces a warning so Claude doesn't ship untested use cases.
# Soft: never blocks (exit 0).

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[[ -z "$file" ]] && exit 0
case "$file" in
  *.ts) ;;
  *) exit 0 ;;
esac

# Only applies to use-case files.
case "$file" in
  */application/use-cases/*)  ;;
  *) exit 0 ;;
esac

# Skip if it IS the test file.
case "$file" in
  *.test.ts) exit 0 ;;
esac

base="${file%.ts}"
test_file="${base}.test.ts"

if [[ ! -f "$test_file" ]]; then
  {
    printf 'No test file found for use case:\n'
    printf '  source: %s\n' "$file"
    printf '  expected: %s\n' "$test_file"
    printf '\nCreate a unit test with an in-memory fake repository (see .claude/rules/testing.md).\n'
  } >&2
fi

exit 0
