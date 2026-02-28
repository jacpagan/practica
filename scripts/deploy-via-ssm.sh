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

# Ensure old containers do not keep host ports (especially :8000) allocated.
compose -f docker-compose.prod.yml down --remove-orphans || true
docker ps --filter publish=8000 -q | xargs -r docker rm -f

compose -f docker-compose.prod.yml up -d --build

for i in $(seq 1 60); do
  curl -fsS -H "Host: practica.jpagan.com" http://127.0.0.1:8000/health/ && ok=1 && break || sleep 2
done
if [ "${ok:-}" != "1" ]; then echo 'Backend failed health check' >&2; compose -f docker-compose.prod.yml logs --tail=200 backend || true; exit 1; fi

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
