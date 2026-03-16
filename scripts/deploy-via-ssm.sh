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
rm -f /opt/practica/.deploy-success /opt/practica/.deploy-failed
trap 'touch /opt/practica/.deploy-failed' ERR

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
export DEPLOYED_GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')

printf '%s' "__ENV_B64__" | base64 -d > .env.production
set -a; source .env.production; set +a
: "${POSTGRES_DB:=practica_prod}"
: "${POSTGRES_USER:=practica}"
: "${POSTGRES_PASSWORD:=${DB_PASSWORD:-}}"
export POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD

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

# Ensure DB schema and schedule periodic coach metrics aggregation.
compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py migrate
cat > /etc/cron.d/practica-coach-metrics <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 * * * * root cd /opt/practica && if docker compose version >/dev/null 2>&1; then docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py build_coach_metrics --days 35; elif command -v docker-compose >/dev/null 2>&1; then docker-compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py build_coach_metrics --days 35; fi >> /var/log/practica-coach-metrics.log 2>&1
CRON
chmod 0644 /etc/cron.d/practica-coach-metrics
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

backend_ok=0
for i in $(seq 1 60); do
  curl -fsS -H "Host: practica.jpagan.com" http://127.0.0.1:8000/health/ && backend_ok=1 && break || sleep 2
done
if [ "$backend_ok" != "1" ]; then
  echo 'Backend failed health check' >&2
  compose -f docker-compose.prod.yml logs --tail=200 backend || true
  exit 1
fi

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

public_ok=0
for i in $(seq 1 30); do
  curl -fsS https://practica.jpagan.com/health/ && public_ok=1 && break || sleep 2
done
if [ "$public_ok" != "1" ]; then
  echo 'Public health check failed' >&2
  exit 1
fi

DEPLOYED_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
touch /opt/practica/.deploy-success
echo "DEPLOY_SUMMARY ref=$REF sha=$DEPLOYED_SHA backend_health=pass public_health=pass"
EOS
)

REMOTE_SCRIPT="${REMOTE_SCRIPT//__ENV_B64__/$ENV_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__GIT_REF__/${GIT_REF:-main}}"
REMOTE_B64=$(printf '%s' "$REMOTE_SCRIPT" | base64 | tr -d '\n')
COMMAND="mkdir -p /opt/practica && rm -f /opt/practica/.deploy-success /opt/practica/.deploy-failed && : > /opt/practica/deploy.log && echo '$REMOTE_B64' | base64 -d > /tmp/practica-deploy.sh && chmod +x /tmp/practica-deploy.sh && (systemctl stop practica-deploy.service 2>/dev/null || true) && (systemctl reset-failed practica-deploy.service 2>/dev/null || true) && systemd-run --unit practica-deploy --collect --no-block /bin/bash -lc '/tmp/practica-deploy.sh >> /opt/practica/deploy.log 2>&1'"
COMMAND_ESCAPED=$(printf '%s' "$COMMAND" | sed 's/\\/\\\\/g; s/"/\\"/g')
PARAMS_JSON="{\"commands\":[\"$COMMAND_ESCAPED\"]}"

send_short_ssm() {
  local inline_command="$1"
  local comment="$2"
  local escaped
  local params
  escaped=$(printf '%s' "$inline_command" | sed 's/\\/\\\\/g; s/"/\\"/g')
  params="{\"commands\":[\"$escaped\"]}"
  aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --comment "$comment" \
    --timeout-seconds 120 \
    --parameters "$params" \
    --query "Command.CommandId" --output text
}

wait_for_ssm_output() {
  local command_id="$1"
  local final_status="PENDING"
  for _ in $(seq 1 30); do
    status=$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" --query 'Status' --output text 2>/dev/null || echo "PENDING")
    if [ "$status" = "Success" ]; then
      final_status="$status"
      break
    fi
    if [ "$status" = "Cancelled" ] || [ "$status" = "Failed" ] || [ "$status" = "TimedOut" ]; then
      aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" --output text || true
      return 1
    fi
    sleep 1
  done
  if [ "$final_status" != "Success" ]; then
    echo "SSM inline command timed out" >&2
    return 1
  fi
  aws ssm get-command-invocation --command-id "$command_id" --instance-id "$INSTANCE_ID" --query 'StandardOutputContent' --output text 2>/dev/null || true
}

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Practica deploy via SSM" \
  --timeout-seconds 3600 \
  --parameters "$PARAMS_JSON" \
  --query "Command.CommandId" --output text)
echo "SSM CommandId: $CMD_ID"

FINAL_STATUS="PENDING"
for i in $(seq 1 30); do
  STATUS=$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query 'Status' --output text 2>/dev/null || echo "PENDING")
  echo "SSM status: $STATUS"
  if [ "$STATUS" = "Success" ]; then
    FINAL_STATUS="$STATUS"
    break
  fi
  if [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "Failed" ] || [ "$STATUS" = "TimedOut" ]; then
    aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --output text || true
    FINAL_STATUS="$STATUS"
    exit 1
  fi
  sleep 1
done
if [ "$FINAL_STATUS" != "Success" ]; then
  echo "SSM launch command timed out" >&2
  exit 1
fi

EXPECTED_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')
PUBLIC_VERIFY_MAX_POLLS="${PUBLIC_VERIFY_MAX_POLLS:-720}"
PUBLIC_FINAL=0
for i in $(seq 1 "$PUBLIC_VERIFY_MAX_POLLS"); do
  HEALTH_JSON=$(curl -fsS --max-time 10 https://practica.jpagan.com/health/ 2>/dev/null || true)
  if [ -n "$HEALTH_JSON" ] && python3 - "$EXPECTED_SHA" <<'PY' <<<"$HEALTH_JSON"
import json
import sys

expected = (sys.argv[1] or '').strip()
try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(1)

status = str(payload.get('status') or '').strip()
deployed_sha = str(payload.get('deployed_sha') or '').strip()
if status == 'healthy' and deployed_sha == expected:
    print(f"healthy deployed_sha={deployed_sha}")
    sys.exit(0)
sys.exit(1)
PY
  then
    PUBLIC_FINAL=1
    break
  fi
  echo "Waiting for public deploy: expected sha ${EXPECTED_SHA:-unknown}"
  sleep 5
done
if [ "$PUBLIC_FINAL" != "1" ]; then
  echo "Public deploy verification timed out" >&2
  STATUS_CMD_ID=$(send_short_ssm "if [ -f /opt/practica/.deploy-success ]; then echo success; elif [ -f /opt/practica/.deploy-failed ]; then echo failed; else echo pending; fi" "Practica deploy status")
  DEPLOY_STATUS=$(wait_for_ssm_output "$STATUS_CMD_ID" | tr -d '\r' | tail -n 1)
  echo "Remote deploy status: ${DEPLOY_STATUS:-pending}"
  LOG_CMD_ID=$(send_short_ssm "tail -n 200 /opt/practica/deploy.log 2>/dev/null || true" "Practica deploy log tail")
  wait_for_ssm_output "$LOG_CMD_ID" || true
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "command_id=$CMD_ID" >> "$GITHUB_OUTPUT"
  echo "ssm_status=Success" >> "$GITHUB_OUTPUT"
fi
