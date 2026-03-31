#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-create_and_verify}"
BACKUP_DIR="${BACKUP_DIR:-/opt/practica-backups}"
KEEP_COUNT="${KEEP_COUNT:-10}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-practica-backend-1}"
DB_CONTAINER="${DB_CONTAINER:-practica-db-1}"

for numeric_var in KEEP_COUNT BACKUP_MAX_AGE_HOURS; do
  value="${!numeric_var}"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$numeric_var must be an integer" >&2
    exit 1
  fi
done

inspect_env_value() {
  local container_name="$1"
  local key="$2"
  docker inspect "$container_name" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n "s/^${key}=//p" | head -n 1
}

latest_backup_path() {
  ls -1dt "$BACKUP_DIR"/practica_prod_*.sql.gz 2>/dev/null | head -n 1 || true
}

backup_age_hours() {
  local backup_path="$1"
  local now_epoch backup_mtime
  now_epoch=$(date +%s)
  backup_mtime=$(stat -c %Y "$backup_path")
  echo $(( (now_epoch - backup_mtime) / 3600 ))
}

require_container() {
  local container_name="$1"
  docker inspect "$container_name" >/dev/null 2>&1 || {
    echo "required container missing: $container_name" >&2
    exit 1
  }
}

require_container "$BACKEND_CONTAINER"
require_container "$DB_CONTAINER"
mkdir -p "$BACKUP_DIR"

DB_NAME="$(inspect_env_value "$BACKEND_CONTAINER" DB_NAME)"
DB_USER="$(inspect_env_value "$BACKEND_CONTAINER" DB_USER)"
DB_PASSWORD="$(inspect_env_value "$BACKEND_CONTAINER" DB_PASSWORD)"
ADMIN_USER="$(inspect_env_value "$DB_CONTAINER" POSTGRES_USER)"
ADMIN_PASSWORD="$(inspect_env_value "$DB_CONTAINER" POSTGRES_PASSWORD)"

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
  echo "could not resolve live database credentials from $BACKEND_CONTAINER" >&2
  exit 1
fi
if [ -z "$ADMIN_USER" ]; then
  ADMIN_USER="postgres"
fi

TEMP_DB=""
cleanup() {
  if [ -n "$TEMP_DB" ]; then
    docker exec -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
      psql -h localhost -U "$ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS ${TEMP_DB} WITH (FORCE);" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

create_backup() {
  local ts backup_file
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  backup_file="$BACKUP_DIR/practica_prod_${ts}.sql.gz"

  docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    pg_dump -h localhost -U "$DB_USER" "$DB_NAME" | gzip -1 > "$backup_file"

  ls -1dt "$BACKUP_DIR"/practica_prod_*.sql.gz 2>/dev/null | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm -f
  echo "$backup_file"
}

verify_backup() {
  local backup_file="$1"
  local table_count auth_user_exists session_table_exists restore_ok age_hours size_bytes

  gzip -t "$backup_file"
  TEMP_DB="practica_backup_verify_$(date -u +%Y%m%d%H%M%S)"

  docker exec -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
    psql -h localhost -U "$ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${TEMP_DB} WITH (FORCE);" >/dev/null
  docker exec -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
    psql -h localhost -U "$ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${TEMP_DB};" >/dev/null

  gunzip -c "$backup_file" | docker exec -i -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
    psql -h localhost -U "$ADMIN_USER" -d "$TEMP_DB" -v ON_ERROR_STOP=1 >/dev/null

  table_count=$(docker exec -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
    psql -h localhost -U "$ADMIN_USER" -d "$TEMP_DB" -tA \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
  auth_user_exists=$(docker exec -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
    psql -h localhost -U "$ADMIN_USER" -d "$TEMP_DB" -tA \
    -c "SELECT CASE WHEN to_regclass('public.auth_user') IS NULL THEN 0 ELSE 1 END;")
  session_table_exists=$(docker exec -e PGPASSWORD="$ADMIN_PASSWORD" "$DB_CONTAINER" \
    psql -h localhost -U "$ADMIN_USER" -d "$TEMP_DB" -tA \
    -c "SELECT CASE WHEN to_regclass('public.videos_session') IS NULL THEN 0 ELSE 1 END;")

  if [ "${table_count:-0}" -gt 0 ] && [ "$auth_user_exists" = "1" ] && [ "$session_table_exists" = "1" ]; then
    restore_ok=1
  else
    restore_ok=0
  fi

  if [ "$restore_ok" != "1" ]; then
    echo "backup restore verification failed for $backup_file" >&2
    exit 1
  fi

  age_hours=$(backup_age_hours "$backup_file")
  size_bytes=$(stat -c %s "$backup_file")

  echo "backup_file=$backup_file"
  echo "backup_size_bytes=$size_bytes"
  echo "backup_age_hours=$age_hours"
  echo "backup_gzip_ok=1"
  echo "backup_restore_ok=1"
  echo "backup_tables=$table_count"
}

echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "mode=$MODE"
echo "backup_dir=$BACKUP_DIR"
echo "keep_count=$KEEP_COUNT"
echo "backup_max_age_hours=$BACKUP_MAX_AGE_HOURS"

case "$MODE" in
  create_and_verify)
    BACKUP_FILE="$(create_backup)"
    ;;
  verify_latest)
    BACKUP_FILE="$(latest_backup_path)"
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 1
    ;;
esac

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "No backup file available to verify" >&2
  exit 1
fi

LATEST_BACKUP_AGE_HOURS="$(backup_age_hours "$BACKUP_FILE")"
if [ "$LATEST_BACKUP_AGE_HOURS" -gt "$BACKUP_MAX_AGE_HOURS" ]; then
  echo "Latest backup is stale: age_hours=$LATEST_BACKUP_AGE_HOURS max_age_hours=$BACKUP_MAX_AGE_HOURS" >&2
  exit 1
fi

verify_backup "$BACKUP_FILE"
echo "backup_status=ok"
