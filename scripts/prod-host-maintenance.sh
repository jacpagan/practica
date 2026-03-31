#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-auto}"
PRUNE_THRESHOLD="${PRUNE_THRESHOLD:-85}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-90}"
BACKUP_DIR="${BACKUP_DIR:-/opt/practica-backups}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"

for numeric_var in PRUNE_THRESHOLD ALERT_THRESHOLD BACKUP_MAX_AGE_HOURS; do
  value="${!numeric_var}"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$numeric_var must be an integer" >&2
    exit 1
  fi
done

if [ "$ALERT_THRESHOLD" -lt "$PRUNE_THRESHOLD" ]; then
  echo "ALERT_THRESHOLD should be greater than or equal to PRUNE_THRESHOLD" >&2
  exit 1
fi

disk_use_pct() {
  df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}'
}

report() {
  echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "disk_use_pct=$(disk_use_pct)"
  echo "uptime=$(uptime | sed 's/^[[:space:]]*//')"
  echo "disk=$(df -h / | tail -n 1)"
  echo "memory=$(free -m | awk 'NR==2 {printf("mem_mb total=%s used=%s free=%s available=%s", $2, $3, $4, $7)}')"
  echo "swap=$(free -m | awk 'NR==3 {printf("swap_mb total=%s used=%s free=%s", $2, $3, $4)}')"
  latest_backup_report
  docker system df || true
}

latest_backup_report() {
  latest_backup=$(ls -1dt "$BACKUP_DIR"/practica_prod_*.sql.gz 2>/dev/null | head -n 1 || true)
  if [ -z "$latest_backup" ]; then
    echo "backup_status=missing"
    echo "backup_latest=none"
    echo "backup_age_hours=unknown"
    echo "backup_gzip_ok=0"
    return
  fi

  backup_mtime=$(stat -c %Y "$latest_backup")
  backup_size_bytes=$(stat -c %s "$latest_backup")
  now_epoch=$(date +%s)
  backup_age_hours=$(( (now_epoch - backup_mtime) / 3600 ))
  if gzip -t "$latest_backup" >/dev/null 2>&1; then
    backup_gzip_ok=1
  else
    backup_gzip_ok=0
  fi

  if [ "$backup_gzip_ok" = "1" ] && [ "$backup_age_hours" -le "$BACKUP_MAX_AGE_HOURS" ]; then
    backup_status=ok
  elif [ "$backup_gzip_ok" != "1" ]; then
    backup_status=corrupt
  else
    backup_status=stale
  fi

  echo "backup_status=$backup_status"
  echo "backup_latest=$latest_backup"
  echo "backup_size_bytes=$backup_size_bytes"
  echo "backup_age_hours=$backup_age_hours"
  echo "backup_gzip_ok=$backup_gzip_ok"
}

prune_unused() {
  docker container prune -f || true
  docker image prune -af || true
  docker builder prune -af || true
  docker volume prune -f || true
}

echo "mode=$MODE"
echo "threshold=$PRUNE_THRESHOLD"
echo "alert_threshold=$ALERT_THRESHOLD"
echo "backup_dir=$BACKUP_DIR"
echo "backup_max_age_hours=$BACKUP_MAX_AGE_HOURS"
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

FINAL_DISK_USE="$(disk_use_pct)"
echo "final_disk_use_pct=$FINAL_DISK_USE"
echo "alert_low_disk=$([ "$FINAL_DISK_USE" -ge "$ALERT_THRESHOLD" ] && echo 1 || echo 0)"

LATEST_BACKUP_STATUS=$(ls -1dt "$BACKUP_DIR"/practica_prod_*.sql.gz 2>/dev/null | head -n 1 >/dev/null && latest_backup_report | awk -F= '/^backup_status=/{print $2; exit}' || echo missing)
if [ "$LATEST_BACKUP_STATUS" = "ok" ]; then
  echo "alert_backup=0"
else
  echo "alert_backup=1"
fi
