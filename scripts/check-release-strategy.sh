#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "release-strategy-check: $1" >&2
  exit 1
}

if [ -f ".github/workflows/deploy-staging-ssm.yml" ]; then
  fail "staging workflow reintroduced (.github/workflows/deploy-staging-ssm.yml exists)."
fi

production_workflows=(
  ".github/workflows/deploy.yml"
  ".github/workflows/deploy-ssm.yml"
)

for wf in "${production_workflows[@]}"; do
  [ -f "$wf" ] || fail "required production workflow missing: $wf"

  branch_line="$(grep -m 1 -E "^[[:space:]]*branches:[[:space:]]*\\[" "$wf" || true)"
  [ -n "$branch_line" ] || fail "$wf is missing a push branches declaration."

  case "$branch_line" in
    *"[ main ]"*|*"[main]"*) ;;
    *) fail "$wf must restrict push deploys to main only. Found: $branch_line" ;;
  esac

  if echo "$branch_line" | grep -q ","; then
    fail "$wf must not include multiple push branches. Found: $branch_line"
  fi

  if echo "$branch_line" | grep -q "\\*"; then
    fail "$wf must not include wildcard push branches. Found: $branch_line"
  fi
done

echo "release-strategy-check: pass (main -> production only)."
