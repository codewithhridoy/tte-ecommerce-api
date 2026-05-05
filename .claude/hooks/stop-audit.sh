#!/usr/bin/env bash
# Stop hook — runs once when the session ends.
#
# Final pass over files modified during the session. Catches:
#   - leftover console.log
#   - .only / .skip in tests
#   - TODO(claude) markers
# Output is informational. Never exits non-zero.

set -euo pipefail

input=$(cat)

root=$(pwd)
while [[ "$root" != "/" && ! -f "$root/package.json" ]]; do
  root=$(dirname "$root")
done
[[ -f "$root/package.json" ]] || exit 0

cd "$root"

# Best-effort: list files changed in the working tree (uncommitted).
if ! command -v git >/dev/null 2>&1 || ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

files=$(git diff --name-only --diff-filter=AM HEAD 2>/dev/null | grep -E '\.(ts|tsx|js)$' || true)
[[ -z "$files" ]] && exit 0

issues=()
while IFS= read -r f; do
  [[ -f "$f" ]] || continue
  if grep -nE '^\s*console\.(log|debug|info)\s*\(' "$f" >/dev/null 2>&1; then
    issues+=("$f: console.log left in source")
  fi
  if grep -nE '\b(it|describe|test)\.(only|skip)\s*\(' "$f" >/dev/null 2>&1; then
    issues+=("$f: .only or .skip left in tests")
  fi
  if grep -n 'TODO(claude)' "$f" >/dev/null 2>&1; then
    issues+=("$f: TODO(claude) marker — finish or remove")
  fi
done <<<"$files"

if [[ ${#issues[@]} -gt 0 ]]; then
  {
    printf 'Stop-time audit — issues to address before commit:\n\n'
    printf '  %s\n' "${issues[@]}"
  } >&2
fi

exit 0
