#!/usr/bin/env bash
set -euo pipefail

ENV_B64=$(printf '%s' "${ENV_PRODUCTION:-}" | base64 | tr -d '\n')
BACKEND_IMAGE_B64=$(printf '%s' "${BACKEND_IMAGE:-}" | base64 | tr -d '\n')
ECR_REGISTRY_B64=$(printf '%s' "${ECR_REGISTRY:-}" | base64 | tr -d '\n')
ECR_PASSWORD_B64=$(printf '%s' "${ECR_PASSWORD:-}" | base64 | tr -d '\n')
MEDIA_CONVERT_ROLE_ARN_B64=$(printf '%s' "${AWS_MEDIA_CONVERT_ROLE_ARN:-}" | base64 | tr -d '\n')
MEDIA_CONVERT_ENDPOINT_URL_B64=$(printf '%s' "${AWS_MEDIA_CONVERT_ENDPOINT_URL:-}" | base64 | tr -d '\n')
ADMIN_URL_B64=$(printf '%s' "${ADMIN_URL:-}" | base64 | tr -d '\n')

REMOTE_SCRIPT=$(cat <<'EOS'
#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="/opt/practica-runtime"
BACKUP_DIR="/opt/practica-backups"

mkdir -p /opt/practica
mkdir -p "$RUNTIME_DIR" "$BACKUP_DIR"
cd /opt/practica
export HOME=/root
git config --global --add safe.directory /opt/practica
rm -f "$RUNTIME_DIR/.deploy-success" "$RUNTIME_DIR/.deploy-failed"
trap 'touch "$RUNTIME_DIR/.deploy-failed"' ERR

if ! command -v git >/dev/null 2>&1; then apt-get update && apt-get install -y git; fi
if ! command -v docker >/dev/null 2>&1; then echo 'Docker not found. Please install Docker.' && exit 1; fi
if ! command -v nginx >/dev/null 2>&1; then echo 'nginx not found. Please install and configure TLS once.' && exit 1; fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    echo 'docker compose plugin is required on production host.' >&2
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
if git show-ref --verify --quiet "refs/remotes/origin/$REF"; then
  # Branch refs (for example, main): force local branch to exactly match origin.
  git checkout -f -B "$REF" "origin/$REF"
  git reset --hard "origin/$REF"
elif git rev-parse --verify --quiet "$REF^{commit}" >/dev/null 2>&1; then
  # Commit refs (for example, workflow-dispatch SHA): detach at exact commit.
  git checkout -f --detach "$REF"
else
  echo "Requested deploy ref not found: $REF" >&2
  exit 1
fi
git clean -fd
export DEPLOYED_GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')

printf '%s' "__ENV_B64__" | base64 -d > .env.production
MEDIA_CONVERT_ROLE_ARN=$(printf '%s' "__MEDIA_CONVERT_ROLE_ARN_B64__" | base64 -d)
MEDIA_CONVERT_ENDPOINT_URL=$(printf '%s' "__MEDIA_CONVERT_ENDPOINT_URL_B64__" | base64 -d)
ADMIN_URL=$(printf '%s' "__ADMIN_URL_B64__" | base64 -d)
export MEDIA_CONVERT_ROLE_ARN MEDIA_CONVERT_ENDPOINT_URL ADMIN_URL
python3 - <<'PY'
from pathlib import Path
import os

p = Path('.env.production')
lines = p.read_text().splitlines()
updates = {}
role_arn = os.environ.get('MEDIA_CONVERT_ROLE_ARN', '').strip()
endpoint_url = os.environ.get('MEDIA_CONVERT_ENDPOINT_URL', '').strip()
admin_url = os.environ.get('ADMIN_URL', '').strip()
if role_arn:
    updates['AWS_MEDIA_CONVERT_ROLE_ARN'] = role_arn
if endpoint_url:
    updates['AWS_MEDIA_CONVERT_ENDPOINT_URL'] = endpoint_url
if admin_url:
    updates['ADMIN_URL'] = admin_url

if updates:
    out = []
    seen = set()
    for line in lines:
        if '=' in line:
            key = line.split('=', 1)[0].strip()
            if key in updates:
                if key in seen:
                    continue
                out.append(f'{key}={updates[key]}')
                seen.add(key)
                continue
        out.append(line)
    for key, value in updates.items():
        if key not in seen:
            out.append(f'{key}={value}')
    p.write_text('\n'.join(out) + '\n')

# Production uses the EC2 instance profile for AWS API access — never static IAM user keys.
strip_keys = {'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'}
lines = p.read_text().splitlines()
filtered = []
removed = []
for line in lines:
    if '=' in line:
        key = line.split('=', 1)[0].strip()
        if key in strip_keys:
            removed.append(key)
            continue
    filtered.append(line)
if removed:
    print('Removed static AWS access keys from .env.production (use instance profile): ' + ', '.join(sorted(set(removed))))
    p.write_text('\n'.join(filtered) + ('\n' if filtered else ''))
PY
set -a; source .env.production; set +a
BACKEND_IMAGE=$(printf '%s' "__BACKEND_IMAGE_B64__" | base64 -d)
ECR_REGISTRY=$(printf '%s' "__ECR_REGISTRY_B64__" | base64 -d)
ECR_PASSWORD=$(printf '%s' "__ECR_PASSWORD_B64__" | base64 -d)
: "${POSTGRES_DB:=practica_prod}"
: "${POSTGRES_USER:=practica}"
if [ -n "${DB_PASSWORD:-}" ]; then
  POSTGRES_PASSWORD="${DB_PASSWORD}"
elif [ -z "${POSTGRES_PASSWORD:-}" ]; then
  POSTGRES_PASSWORD=""
fi
export POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD BACKEND_IMAGE ECR_REGISTRY ECR_PASSWORD

if [ -n "${BACKEND_IMAGE:-}" ]; then
  if [ -n "${ECR_PASSWORD:-}" ] && [ -n "${ECR_REGISTRY:-}" ]; then
    printf '%s' "$ECR_PASSWORD" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  else
    AWS_REGION_VALUE="${AWS_REGION:-${AWS_S3_REGION_NAME:-us-east-1}}"
    aws ecr get-login-password --region "$AWS_REGION_VALUE" | docker login --username AWS --password-stdin "${BACKEND_IMAGE%%/*}"
  fi
fi

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
mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_FILE="$BACKUP_DIR/practica_prod_${TS}.sql.gz"
if PGPASSWORD="${POSTGRES_PASSWORD:-}" compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-practica}" "${POSTGRES_DB:-practica_prod}" | gzip -1 > "$BACKUP_FILE"; then
  echo "Wrote DB snapshot: $BACKUP_FILE"
  ls -1dt "$BACKUP_DIR"/practica_prod_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
  if command -v aws >/dev/null 2>&1 && [ -n "${AWS_STORAGE_BUCKET_NAME:-}" ]; then
    aws s3 cp "$BACKUP_FILE" "s3://${AWS_STORAGE_BUCKET_NAME}/db-backups/$(basename "$BACKUP_FILE")" >/dev/null 2>&1 || true
  fi
else
  rm -f "$BACKUP_FILE" || true
  echo "DB snapshot skipped (db not ready or db missing)." >&2
fi

# Keep supporting services up while preparing the next backend image.
compose -f docker-compose.prod.yml up -d db redis

# Free stale Docker layers before pulling the next backend image. Running
# containers and their images are kept; volumes are not pruned here.
docker container prune -f || true
docker image prune -af || true
docker builder prune -af || true

# Build or pull next backend image, then run prep work before cutting over traffic.
if [ -n "${BACKEND_IMAGE:-}" ]; then
  docker pull "$BACKEND_IMAGE"
else
  compose -f docker-compose.prod.yml build backend
fi
compose -f docker-compose.prod.yml run --rm backend python /app/apps/backend/manage.py migrate
compose -f docker-compose.prod.yml run --rm backend python /app/apps/backend/manage.py collectstatic --noinput

# Recreate only backend for the final cutover.
docker ps -aq \
  --filter label=com.docker.compose.project=practica \
  --filter label=com.docker.compose.service=backend | xargs -r docker rm -f
docker ps --filter publish=8000 -q | xargs -r docker rm -f
compose -f docker-compose.prod.yml up -d --force-recreate --no-deps backend

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
  HEALTH_JSON=$(curl -fsS -H "Host: practica.jpagan.com" http://127.0.0.1:8000/health/ 2>/dev/null || true)
  if [ -n "$HEALTH_JSON" ] && python3 -c '
import json
import sys

expected = (sys.argv[1] or "").strip()
try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(1)

status = str(payload.get("status") or "").strip()
deployed_sha = str(payload.get("deployed_sha") or "").strip()
sys.exit(0 if status == "healthy" and deployed_sha == expected else 1)
' "$DEPLOYED_GIT_SHA" <<<"$HEALTH_JSON"
  then
    backend_ok=1
    break
  fi
  sleep 2
done
if [ "$backend_ok" != "1" ]; then
  echo 'Backend failed health check' >&2
  compose -f docker-compose.prod.yml logs --tail=200 backend || true
  exit 1
fi

cat > /etc/cron.d/practica-mediaconvert-sync <<'CRON'
* * * * * root /usr/bin/flock -n /tmp/practica-mediaconvert-sync.lock /bin/bash -lc 'cd /opt/practica && docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py sync_mediaconvert_jobs' >> /opt/practica-runtime/mediaconvert-sync.log 2>&1
CRON
chmod 644 /etc/cron.d/practica-mediaconvert-sync

cat > /etc/cron.d/practica-multipart-cleanup <<'CRON'
17 * * * * root /usr/bin/flock -n /tmp/practica-multipart-cleanup.lock /bin/bash -lc 'cd /opt/practica && docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py cleanup_multipart_uploads' >> /opt/practica-runtime/multipart-cleanup.log 2>&1
CRON
chmod 644 /etc/cron.d/practica-multipart-cleanup
systemctl restart cron || service cron restart || true

echo 'Backfilling browser-safe feedback video playback files...'
compose -f docker-compose.prod.yml run --rm backend \
  python /app/apps/backend/manage.py backfill_feedback_video_playback

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

# Optional CDN invalidation (CloudFront). If AWS_CLOUDFRONT_DISTRIBUTION_ID is set in environment,
# trigger a short invalidation for HTML and asset paths. This is best-effort and non-fatal.
if [ -n "${AWS_CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "Creating CloudFront invalidation for index and assets..."
  aws cloudfront create-invalidation \
    --distribution-id "$AWS_CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/index.html" "/" "/assets/*" "/static/*" "/favicon.ico" >/dev/null 2>&1 || \
    echo "CloudFront invalidation skipped or failed (non-fatal)."
fi

# Quick public smoke: fetch index and check build SHA injection and asset tags are present.
echo "Running public HTML smoke checks..."
HTML=$(curl -fsS --max-time 10 https://practica.jpagan.com/ 2>/dev/null || true)
if [ -n "$HTML" ]; then
  if echo "$HTML" | grep -q "practica:sha" && echo "$HTML" | grep -q "assets/index-"; then
    echo "Public HTML looks good (sha+assets)."
  else
    echo "Public HTML smoke check did not find expected markers (non-fatal)." >&2
  fi
else
  echo "Public HTML fetch failed (non-fatal)." >&2
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
touch "$RUNTIME_DIR/.deploy-success"
echo "DEPLOY_SUMMARY ref=$REF sha=$DEPLOYED_SHA backend_health=pass public_health=pass"
EOS
)

REMOTE_SCRIPT="${REMOTE_SCRIPT//__ENV_B64__/$ENV_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__BACKEND_IMAGE_B64__/$BACKEND_IMAGE_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__ECR_REGISTRY_B64__/$ECR_REGISTRY_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__ECR_PASSWORD_B64__/$ECR_PASSWORD_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__MEDIA_CONVERT_ROLE_ARN_B64__/$MEDIA_CONVERT_ROLE_ARN_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__MEDIA_CONVERT_ENDPOINT_URL_B64__/$MEDIA_CONVERT_ENDPOINT_URL_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__ADMIN_URL_B64__/$ADMIN_URL_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__GIT_REF__/${GIT_REF:-main}}"
REMOTE_B64=$(printf '%s' "$REMOTE_SCRIPT" | base64 | tr -d '\n')
COMMAND="mkdir -p /opt/practica /opt/practica-runtime /opt/practica-backups && rm -f /opt/practica-runtime/.deploy-success /opt/practica-runtime/.deploy-failed && : > /opt/practica-runtime/deploy.log && echo '$REMOTE_B64' | base64 -d > /tmp/practica-deploy.sh && chmod +x /tmp/practica-deploy.sh && nohup /bin/bash /tmp/practica-deploy.sh >> /opt/practica-runtime/deploy.log 2>&1 </dev/null & echo launched"
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
SSM_LAUNCH_MAX_POLLS="${SSM_LAUNCH_MAX_POLLS:-300}"
SSM_LAUNCH_POLL_INTERVAL="${SSM_LAUNCH_POLL_INTERVAL:-2}"
for i in $(seq 1 "$SSM_LAUNCH_MAX_POLLS"); do
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
  sleep "$SSM_LAUNCH_POLL_INTERVAL"
done
if [ "$FINAL_STATUS" != "Success" ]; then
  echo "SSM launch command timed out" >&2
  exit 1
fi

EXPECTED_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')
PUBLIC_VERIFY_INTERVAL_SECONDS="${PUBLIC_VERIFY_INTERVAL_SECONDS:-5}"
PUBLIC_VERIFY_TIMEOUT_SECONDS="${PUBLIC_VERIFY_TIMEOUT_SECONDS:-900}"
if [ "$PUBLIC_VERIFY_INTERVAL_SECONDS" -le 0 ]; then
  echo "PUBLIC_VERIFY_INTERVAL_SECONDS must be greater than 0" >&2
  exit 1
fi
PUBLIC_VERIFY_MAX_POLLS=$(( (PUBLIC_VERIFY_TIMEOUT_SECONDS + PUBLIC_VERIFY_INTERVAL_SECONDS - 1) / PUBLIC_VERIFY_INTERVAL_SECONDS ))
PUBLIC_STABLE_SUCCESSES="${PUBLIC_STABLE_SUCCESSES:-3}"
PUBLIC_FINAL=0
PUBLIC_STREAK=0
echo "Public verify window: timeout=${PUBLIC_VERIFY_TIMEOUT_SECONDS}s interval=${PUBLIC_VERIFY_INTERVAL_SECONDS}s stable_successes=${PUBLIC_STABLE_SUCCESSES}"
for i in $(seq 1 "$PUBLIC_VERIFY_MAX_POLLS"); do
  HEALTH_JSON=$(curl -fsS --max-time 10 https://practica.jpagan.com/health/ 2>/dev/null || true)
  if [ -n "$HEALTH_JSON" ] && python3 -c '
import json
import sys

expected = (sys.argv[1] or "").strip()
try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(1)

status = str(payload.get("status") or "").strip()
deployed_sha = str(payload.get("deployed_sha") or "").strip()
if status == "healthy" and deployed_sha == expected:
    print(f"healthy deployed_sha={deployed_sha}")
    sys.exit(0)
sys.exit(1)
' "$EXPECTED_SHA" <<<"$HEALTH_JSON"
  then
    READY_JSON=$(curl -fsS --max-time 10 https://practica.jpagan.com/ready/ 2>/dev/null || true)
    if [ -n "$READY_JSON" ] && python3 <<'PY' <<<"$READY_JSON"
import json
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(1)

sys.exit(0 if str(payload.get('status') or '').strip() == 'ready' else 1)
PY
    then
      PUBLIC_STREAK=$((PUBLIC_STREAK + 1))
      echo "Public deploy healthy ($PUBLIC_STREAK/$PUBLIC_STABLE_SUCCESSES)"
      if [ "$PUBLIC_STREAK" -ge "$PUBLIC_STABLE_SUCCESSES" ]; then
        PUBLIC_FINAL=1
        break
      fi
    else
      PUBLIC_STREAK=0
      echo "Public deploy health matched SHA but readiness is not ready yet"
    fi
  else
    if [ "$PUBLIC_STREAK" -gt 0 ]; then
      echo "Public deploy lost health during verification; retrying"
    else
      elapsed_seconds=$(( (i - 1) * PUBLIC_VERIFY_INTERVAL_SECONDS ))
      remaining_seconds=$(( PUBLIC_VERIFY_TIMEOUT_SECONDS - elapsed_seconds ))
      if [ "$remaining_seconds" -lt 0 ]; then
        remaining_seconds=0
      fi
      echo "Waiting for public deploy: expected sha ${EXPECTED_SHA:-unknown} elapsed=${elapsed_seconds}s remaining=${remaining_seconds}s"
    fi
    PUBLIC_STREAK=0
  fi
  sleep "$PUBLIC_VERIFY_INTERVAL_SECONDS"
done
if [ "$PUBLIC_FINAL" != "1" ]; then
  echo "Public deploy verification timed out after ${PUBLIC_VERIFY_TIMEOUT_SECONDS}s" >&2
  STATUS_CMD_ID=$(send_short_ssm "if [ -f /opt/practica-runtime/.deploy-success ]; then echo success; elif [ -f /opt/practica-runtime/.deploy-failed ]; then echo failed; else echo pending; fi" "Practica deploy status")
  DEPLOY_STATUS=$(wait_for_ssm_output "$STATUS_CMD_ID" | tr -d '\r' | tail -n 1)
  echo "Remote deploy status: ${DEPLOY_STATUS:-pending}"
  LOG_CMD_ID=$(send_short_ssm "tail -n 200 /opt/practica-runtime/deploy.log 2>/dev/null || true" "Practica deploy log tail")
  wait_for_ssm_output "$LOG_CMD_ID" || true
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "command_id=$CMD_ID" >> "$GITHUB_OUTPUT"
  echo "ssm_status=Success" >> "$GITHUB_OUTPUT"
fi
