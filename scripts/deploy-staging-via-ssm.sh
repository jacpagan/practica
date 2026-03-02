#!/usr/bin/env bash
set -euo pipefail

: "${INSTANCE_ID:?INSTANCE_ID is required}"
: "${ENV_STAGING:?ENV_STAGING is required}"

GIT_REF="${GIT_REF:-integrate/app-into-main}"
STAGING_PROJECT_DIR="${STAGING_PROJECT_DIR:-/opt/practica-staging}"
STAGING_HOST_HEADER="${STAGING_HOST_HEADER:-staging.practica.jpagan.com}"
STAGING_PUBLIC_HEALTH_URL="${STAGING_PUBLIC_HEALTH_URL:-}"

ENV_B64=$(printf '%s' "${ENV_STAGING}" | base64 | tr -d '\n')

REMOTE_SCRIPT=$(cat <<'EOS'
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="__PROJECT_DIR__"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"
export HOME=/root
git config --global --add safe.directory "$PROJECT_DIR"

if ! command -v git >/dev/null 2>&1; then apt-get update && apt-get install -y git; fi
if ! command -v docker >/dev/null 2>&1; then echo 'Docker not found. Please install Docker.' && exit 1; fi

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

REPO_URL='https://github.com/jacpagan/practica.git'
if [ ! -d .git ]; then
  git clone "$REPO_URL" .
fi

git fetch --all --prune
REF="__GIT_REF__"
git clean -fd
git checkout -f "$REF" || git checkout -f -B "$REF" "origin/$REF"
git clean -fd
git pull --ff-only origin "$REF" || true

printf '%s' "__ENV_B64__" | base64 -d > .env.staging
cp .env.staging .env
set -a
source .env.staging
set +a

rm -f apps/backend/gunicorn.ctl || true
compose -f docker-compose.prod.yml down --remove-orphans || true
compose -f docker-compose.prod.yml up -d --build
compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py migrate

cat > /etc/cron.d/practica-staging-maintenance <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root cd __PROJECT_DIR__ && if docker compose version >/dev/null 2>&1; then docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py expire_feedback_requests; elif command -v docker-compose >/dev/null 2>&1; then docker-compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py expire_feedback_requests; fi >> /var/log/practica-staging-feedback-expiry.log 2>&1
0 * * * * root cd __PROJECT_DIR__ && if docker compose version >/dev/null 2>&1; then docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py build_coach_metrics --days 35; elif command -v docker-compose >/dev/null 2>&1; then docker-compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py build_coach_metrics --days 35; fi >> /var/log/practica-staging-coach-metrics.log 2>&1
CRON
chmod 0644 /etc/cron.d/practica-staging-maintenance
systemctl reload cron || service cron reload || true

ok=0
for i in $(seq 1 60); do
  if curl -fsS -H "Host: __STAGING_HOST_HEADER__" http://127.0.0.1:8000/health/ >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != "1" ]; then
  echo 'Staging backend failed local health check' >&2
  compose -f docker-compose.prod.yml logs --tail=200 backend || true
  exit 1
fi

if [ -n "__STAGING_PUBLIC_HEALTH_URL__" ]; then
  ok=0
  for i in $(seq 1 30); do
    if curl -fsS "__STAGING_PUBLIC_HEALTH_URL__" >/dev/null; then
      ok=1
      break
    fi
    sleep 2
  done
  if [ "$ok" != "1" ]; then
    echo 'Staging public health check failed' >&2
    exit 1
  fi
fi

echo "Staging deploy succeeded for ref $REF"
EOS
)

REMOTE_SCRIPT="${REMOTE_SCRIPT//__ENV_B64__/$ENV_B64}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__GIT_REF__/$GIT_REF}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__PROJECT_DIR__/$STAGING_PROJECT_DIR}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__STAGING_HOST_HEADER__/$STAGING_HOST_HEADER}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__STAGING_PUBLIC_HEALTH_URL__/$STAGING_PUBLIC_HEALTH_URL}"

REMOTE_B64=$(printf '%s' "$REMOTE_SCRIPT" | base64 | tr -d '\n')
COMMAND="echo '$REMOTE_B64' | base64 -d > /tmp/practica-staging-deploy.sh && bash /tmp/practica-staging-deploy.sh"
COMMAND_ESCAPED=$(printf '%s' "$COMMAND" | sed 's/\\/\\\\/g; s/"/\\"/g')
PARAMS_JSON="{\"commands\":[\"$COMMAND_ESCAPED\"]}"

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Practica staging deploy via SSM" \
  --parameters "$PARAMS_JSON" \
  --query "Command.CommandId" --output text)
echo "SSM CommandId: $CMD_ID"

for i in $(seq 1 120); do
  STATUS=$(aws ssm list-command-invocations --command-id "$CMD_ID" --details --query 'CommandInvocations[0].Status' --output text 2>/dev/null || echo "PENDING")
  echo "SSM status: $STATUS"
  if [ "$STATUS" = "Success" ]; then
    exit 0
  fi
  if [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "Failed" ] || [ "$STATUS" = "TimedOut" ]; then
    aws ssm list-command-invocations --command-id "$CMD_ID" --details --output text || true
    exit 1
  fi
  sleep 3
done

echo "SSM staging deploy command timed out" >&2
exit 1
