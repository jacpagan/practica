#!/usr/bin/env bash
set -euo pipefail

COMMANDS=$(cat <<'EOS'
bash -lc "set -euo pipefail

# 1) Ensure project dir
mkdir -p /opt/practica
cd /opt/practica

# 2) Write .env.production from secret
cat > .env.production << 'ENVEOF'
${ENV_PRODUCTION}
ENVEOF

# 3) Minimal deps checks
if ! command -v git >/dev/null 2>&1; then apt-get update && apt-get install -y git; fi
if ! command -v docker >/dev/null 2>&1; then echo 'Docker not found. Please install Docker.' && exit 1; fi
if ! docker compose version >/dev/null 2>&1; then echo 'docker compose plugin not found. Please install docker-compose-plugin.' && exit 1; fi
if ! command -v nginx >/dev/null 2>&1; then echo 'nginx not found. Please install and configure TLS once.' && exit 1; fi

# 4) Clone or update repo
REPO_URL='https://github.com/jacpagan/practica.git'
if [ ! -d .git ]; then
  git clone "$REPO_URL" .
fi
git fetch --all --prune
REF="${GIT_REF}"
git checkout "$REF"
git pull --ff-only origin "$REF" || true

# 5) Export env
set -a; source .env.production; set +a

# 6) Build and run
docker compose -f docker-compose.prod.yml up -d --build

# 6.1) Ensure database schema is current
docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py migrate

# 6.2) Install periodic SLA expiry job
cat > /etc/cron.d/practica-feedback-expiry <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/10 * * * * root cd /opt/practica && docker compose -f docker-compose.prod.yml exec -T backend python /app/apps/backend/manage.py expire_feedback_requests >> /var/log/practica-feedback-expiry.log 2>&1
CRON
chmod 0644 /etc/cron.d/practica-feedback-expiry
systemctl reload cron || service cron reload || true

# 7) Health check backend
for i in $(seq 1 60); do
  curl -fsS http://127.0.0.1:8000/health && ok=1 && break || sleep 2
done
if [ "${ok:-}" != "1" ]; then echo 'Backend failed health check' >&2; docker compose -f docker-compose.prod.yml logs --tail=200 backend || true; exit 1; fi

# 8) Configure Nginx single-door proxy
SITE=$(grep -RIl "server_name[[:space:]]\+practica.jpagan.com" /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null | head -n1 || true)
if [ -z "$SITE" ]; then SITE=/etc/nginx/sites-available/practica; fi
CERT_LINE=$(grep -E "^\s*ssl_certificate\s" "$SITE" | head -n1 || true)
KEY_LINE=$(grep -E "^\s*ssl_certificate_key\s" "$SITE" | head -n1 || true)
cp -a "$SITE" "$SITE.bak" 2>/dev/null || true
cat > "$SITE" <<NGINXCONF
server {
    listen 443 ssl http2;
    server_name practica.jpagan.com;
    ${CERT_LINE}
    ${KEY_LINE}
    client_max_body_size 2G;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
server {
    listen 80;
    server_name practica.jpagan.com;
    return 301 https://$host$request_uri;
}
NGINXCONF
if [ ! -e /etc/nginx/sites-enabled/practica ]; then ln -sf "$SITE" /etc/nginx/sites-enabled/practica; fi
nginx -t
systemctl reload nginx

# 9) Public health check (best-effort)
for i in $(seq 1 30); do
  curl -fsS https://practica.jpagan.com/health && ok=1 && break || sleep 2
done
if [ "${ok:-}" != "1" ]; then echo 'Public health check failed (check TLS/DNS).'; fi
"
EOS
)

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Practica deploy via SSM" \
  --parameters commands="[$(printf %q "$COMMANDS")]" \
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
