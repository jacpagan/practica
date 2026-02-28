#!/usr/bin/env bash
set -euo pipefail

# Audits remote branches for app indicators and containment in a chosen base branch.
# Usage: ./scripts/branch-audit.sh [base_branch]
# Example: ./scripts/branch-audit.sh origin/cursor/development-environment-setup-2b36

BASE_REF="${1:-origin/cursor/development-environment-setup-2b36}"

if ! git rev-parse --verify -q "$BASE_REF" >/dev/null; then
  echo "Base ref '$BASE_REF' not found. Pass a valid ref like 'origin/branch-name'." >&2
  exit 1
fi

printf "%-50s | %-5s | %-8s | %-8s | %-10s | %-9s | %s\n" Branch Ahead manage.py django settings.py package.json "Last commit"
printf -- '%.0s-' {1..140}; echo

git for-each-ref --format='%(refname:short)' refs/remotes/origin \
  | sed 's#^origin/##' \
  | sort \
  | while read -r b; do
      [ "$b" = "HEAD" ] && continue
      ahead=$(git rev-list --count main..origin/$b 2>/dev/null || echo 0)
      has_manage=$(git ls-tree -r --name-only origin/$b | rg -n '(^|/)manage.py$' >/dev/null && echo yes || echo no)
      has_django=$(git ls-tree -r --name-only origin/$b | rg -n 'django|settings.py|urls.py|wsgi.py|asgi.py|migrations' >/dev/null && echo yes || echo no)
      has_settings=$(git ls-tree -r --name-only origin/$b | rg -n 'settings.py' >/dev/null && echo yes || echo no)
      has_pkg=$(git ls-tree -r --name-only origin/$b | rg -n '^package.json$|/package.json$' >/dev/null && echo yes || echo no)
      last=$(git log -1 --pretty=format:'%h %s' origin/$b 2>/dev/null)
      printf "%-50s | %-5s | %-8s | %-8s | %-10s | %-9s | %s\n" "$b" "$ahead" "$has_manage" "$has_django" "$has_settings" "$has_pkg" "$last"
    done

echo
printf "%-50s | %-10s | %s\n" Branch InBase Last
printf -- '%.0s-' {1..100}; echo

git for-each-ref --format='%(refname:short)' refs/remotes/origin \
  | sed 's#^origin/##' \
  | sort \
  | while read -r b; do
      case "$b" in HEAD) continue ;; esac
      if [ "origin/$b" = "$BASE_REF" ] || [ "$b" = main ]; then continue; fi
      if git merge-base --is-ancestor origin/$b "$BASE_REF"; then inbase=yes; else inbase=no; fi
      last=$(git log -1 --pretty=format:'%h %s' origin/$b 2>/dev/null)
      printf "%-50s | %-10s | %s\n" "$b" "$inbase" "$last"
    done

