#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-auto}"
PRUNE_THRESHOLD="${PRUNE_THRESHOLD:-85}"

if ! [[ "$PRUNE_THRESHOLD" =~ ^[0-9]+$ ]]; then
  echo "PRUNE_THRESHOLD must be an integer" >&2
  exit 1
fi

disk_use_pct() {
  df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}'
}

report() {
  echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "uptime=$(uptime | sed 's/^[[:space:]]*//')"
  echo "disk=$(df -h / | tail -n 1)"
  echo "memory=$(free -m | awk 'NR==2 {printf("mem_mb total=%s used=%s free=%s available=%s", $2, $3, $4, $7)}')"
  echo "swap=$(free -m | awk 'NR==3 {printf("swap_mb total=%s used=%s free=%s", $2, $3, $4)}')"
  docker system df || true
}

prune_unused() {
  docker container prune -f || true
  docker image prune -af || true
  docker builder prune -af || true
}

echo "mode=$MODE"
echo "threshold=$PRUNE_THRESHOLD"
echo "before"
report

CURRENT_DISK_USE="$(disk_use_pct)"

case "$MODE" in
  report)
    ;;
  prune)
    prune_unused
    ;;
  auto)
    if [ "$CURRENT_DISK_USE" -ge "$PRUNE_THRESHOLD" ]; then
      prune_unused
    else
      echo "auto-prune skipped disk_use=${CURRENT_DISK_USE}%"
    fi
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 1
    ;;
esac

echo "after"
report
