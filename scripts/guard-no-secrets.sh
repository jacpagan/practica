#!/usr/bin/env bash
set -euo pipefail

echo "[guard] Checking for committed secret env files and keys..."

# List tracked files
FILES=$(git ls-files)

fail=0

# 1) Forbid tracked .env files (except explicit templates/examples)
while IFS= read -r f; do
  base="$(basename "$f")"
  case "$base" in
    .env|.env.*)
      # Allowlist
      if [[ "$base" == ".env.template" ]] || [[ "$base" == "env.example" ]]; then
        continue
      fi
      echo "[guard][error] Forbidden committed env file: $f" >&2
      fail=1
      ;;
  esac
done <<< "$FILES"

# 2) Scan for common secret keys being assigned in tracked files (excluding docs/templates)
# Only flag if pattern looks like an assignment (KEY = VALUE) at line start.
TMP_LIST=$(mktemp)
echo "$FILES" \
  | grep -Ev '^(docs/|\.github/|.*env\.example$|.*\.env\.template$)' \
  > "$TMP_LIST"

if grep -E -n '^[[:space:]]*(AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|DJANGO_SECRET_KEY)[[:space:]]*=' $(cat "$TMP_LIST") 2>/dev/null; then
  echo "[guard][error] Found potential hard-coded secrets in repository (assignments to AWS_*/DJANGO_SECRET_KEY)." >&2
  echo "Please move secrets to GitHub Actions secrets or host env, and remove from git history." >&2
  fail=1
fi

rm -f "$TMP_LIST"

if [[ "$fail" != "0" ]]; then
  echo "[guard] Secret guard failed." >&2
  exit 1
fi

echo "[guard] Secret guard passed."

