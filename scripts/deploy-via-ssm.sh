#!/usr/bin/env bash
set -euo pipefail

ENV_B64=$(printf '%s' "${ENV_PRODUCTION:-}" | base64 | tr -d '\n')

REMOTE_SCRIPT=$(cat <<'EOS'
#!/usr/bin/env bash
set -euo pipefail

mkdir -p /opt/practica
cd /opt/practica
export HOME=/root
git config --global --add safe.directory /opt/practica

if ! command -v git >/dev/null 2>&1; then apt-get update && apt-get install -y git; fi
if ! command -v docker >/dev/null 2>&1; then echo 'Docker not found. Please install Docker.' && exit 1; fi
if ! command -v nginx >/dev/null 2>&1; then echo 'nginx not found. Please install and configure TLS once.' && exit 1; fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo 'Neither docker compose nor docker-compose is available.' >&2
    exit 1
  fi
}

count_records() {
  compose -f docker-compose.prod.yml exec -T backend \
    python /app/apps/backend/manage.py shell -c \
    "from django.contrib.auth import get_user_model; from videos.models import Session; U=get_user_model(); print(f'users={U.objects.count()} sessions={Session.objects.count()}')" 2>/dev/null \
    | tail -n 1 || true
}

extract_metric() {
  key="$1"
  line="$2"
  printf '%s\n' "$line" | sed -n "s/.*${key}=\\([0-9][0-9]*\\).*/\\1/p" | tail -n 1
}

REPO_URL='https://github.com/jacpagan/practica.git'
if [ ! -d .git ]; then
  git init
  git remote add origin "$REPO_URL"
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
fi
git fetch --all --prune
REF="__GIT_REF__"
git clean -fd
git checkout -f "$REF" || git checkout -f -B "$REF" "origin/$REF"
git clean -fd
git pull --ff-only origin "$REF" || true

printf '%s' "__ENV_B64__" | base64 -d > .env.production
set -a; source .env.production; set +a

# Remove stale unix socket from previous runs before building context.
rm -f apps/backend/gunicorn.ctl

# Stop legacy host-level service; Docker backend owns :8000 now.
systemctl stop practica.service || true
systemctl disable practica.service || true
systemctl mask practica.service || true
pkill -f '/opt/practica/.venv/bin/gunicorn' || true

# Capture current DB counts when previous stack is healthy (used for reset protection).
PRE_COUNTS=$(count_records)
PRE_USERS=$(extract_metric users "$PRE_COUNTS")
PRE_SESSIONS=$(extract_metric sessions "$PRE_COUNTS")
echo "Pre-deploy counts: ${PRE_COUNTS:-unavailable}"

# Best-effort DB snapshot before recycling containers.
mkdir -p /opt/practica/backups
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="/opt/practica/backups/practica_prod_${TS}.sql.gz"
if PGPASSWORD="${POSTGRES_PASSWORD:-}" compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-practica}" "${POSTGRES_DB:-practica_prod}" | gzip -1 > "$BACKUP_FILE"; then
  echo "Wrote DB snapshot: $BACKUP_FILE"
  ls -1dt /opt/practica/backups/practica_prod_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
  if command -v aws >/dev/null 2>&1 && [ -n "${AWS_STORAGE_BUCKET_NAME:-}" ]; then
    aws s3 cp "$BACKUP_FILE" "s3://${AWS_STORAGE_BUCKET_NAME}/db-backups/$(basename "$BACKUP_FILE")" >/dev/null 2>&1 || true
  fi
else
  rm -f "$BACKUP_FILE" || true
  echo "DB snapshot skipped (db not ready or db missing)." >&2
fi

# Ensure old containers do not keep host ports (especially :8000) allocated.
compose -f docker-compose.prod.yml down --remove-orphans || true
docker ps --filter publish=8000 -q | xargs -r docker rm -f

compose -f docker-compose.prod.yml up -d --build

# Ensure DB schema and schedule periodic feedback SLA expiry.
compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py migrate
cat > /etc/cron.d/practica-feedback-expiry <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root cd /opt/practica && if docker compose version >/dev/null 2>&1; then docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py expire_feedback_requests; elif command -v docker-compose >/dev/null 2>&1; then docker-compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py expire_feedback_requests; fi >> /var/log/practica-feedback-expiry.log 2>&1
CRON
chmod 0644 /etc/cron.d/practica-feedback-expiry
systemctl reload cron || service cron reload || true

# Apply upload-safe nginx defaults globally (http context).
cat > /etc/nginx/conf.d/practica-upload.conf <<NGINXUPLOAD
client_max_body_size 2G;
client_body_timeout 3600s;
proxy_request_buffering off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
send_timeout 3600s;
NGINXUPLOAD

for i in $(seq 1 60); do
  curl -fsS -H "Host: practica.jpagan.com" http://127.0.0.1:8000/health/ && ok=1 && break || sleep 2
done
if [ "${ok:-}" != "1" ]; then echo 'Backend failed health check' >&2; compose -f docker-compose.prod.yml logs --tail=200 backend || true; exit 1; fi

POST_COUNTS=$(count_records)
POST_USERS=$(extract_metric users "$POST_COUNTS")
POST_SESSIONS=$(extract_metric sessions "$POST_COUNTS")
echo "Post-deploy counts: ${POST_COUNTS:-unavailable}"

if [ "${ALLOW_EMPTY_DB_AFTER_DEPLOY:-0}" != "1" ] \
  && [ -n "${PRE_USERS:-}" ] && [ -n "${PRE_SESSIONS:-}" ] \
  && [ -n "${POST_USERS:-}" ] && [ -n "${POST_SESSIONS:-}" ] \
  && [ $((PRE_USERS + PRE_SESSIONS)) -gt 0 ] \
  && [ $((POST_USERS + POST_SESSIONS)) -eq 0 ]; then
  echo "Safety check failed: DB looked populated before deploy and empty after deploy." >&2
  echo "Set ALLOW_EMPTY_DB_AFTER_DEPLOY=1 in ENV_PRODUCTION only if this reset is intentional." >&2
  exit 1
fi

# Keep nginx reload best-effort; avoid rewriting site config during app deploy.
if ! nginx -t || ! systemctl reload nginx; then
  echo "Nginx reload skipped (existing config may be unmanaged)." >&2
fi

for i in $(seq 1 30); do
  curl -fsS https://practica.jpagan.com/health/ && ok=1 && break || sleep 2
done
if [ "${ok:-}" != "1" ]; then echo 'Public health check failed (check TLS/DNS).'; fi
EOS
)

REMOTE_SCRIPT="${REMOTE_SCRIPT//__ENV_B64__/$ENV_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__GIT_REF__/${GIT_REF:-main}}"
REMOTE_B64=$(printf '%s' "$REMOTE_SCRIPT" | base64 | tr -d '\n')
COMMAND="echo '$REMOTE_B64' | base64 -d > /tmp/practica-deploy.sh && bash /tmp/practica-deploy.sh"
COMMAND_ESCAPED=$(printf '%s' "$COMMAND" | sed 's/\\/\\\\/g; s/"/\\"/g')
PARAMS_JSON="{\"commands\":[\"$COMMAND_ESCAPED\"]}"

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Practica deploy via SSM" \
  --parameters "$PARAMS_JSON" \
  --query "Command.CommandId" --output text)
echo "SSM CommandId: $CMD_ID"

for i in $(seq 1 120); do
  STATUS=$(aws ssm list-command-invocations --command-id "$CMD_ID" --details --query 'CommandInvocations[0].Status' --output text 2>/dev/null || echo "PENDING")
  echo "SSM status: $STATUS"
  if [ "$STATUS" = "Success" ]; then exit 0; fi
  if [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "Failed" ] || [ "$STATUS" = "TimedOut" ]; then
    aws ssm list-command-invocations --command-id "$CMD_ID" --details --output text || true
    exit 1
  fi
  sleep 3
done
echo "SSM command timed out" >&2
exit 1
