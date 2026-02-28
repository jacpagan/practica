#!/bin/bash
# Deploy Practica to EC2 via SSH — zero downtime, preserves database
# Usage: ./scripts/deploy.sh [path-to-ssh-key]
#
# Default key: /tmp/practica-deploy-key.pem
# Instance: 23.22.75.119 (practica.jpagan.com)

set -e

KEY="${1:-/tmp/practica-deploy-key.pem}"
HOST="ubuntu@23.22.75.119"
SSH="ssh -o StrictHostKeyChecking=no -i $KEY $HOST"
BUCKET="practica-media-jpagan"
REGION="us-east-1"

if [ ! -f "$KEY" ]; then
  echo "SSH key not found: $KEY"
  echo "Usage: ./scripts/deploy.sh /path/to/practica-deploy-key.pem"
  exit 1
fi

echo "=== Building frontend ==="
cd "$(dirname "$0")/.."
cd apps/frontend && npm install --silent && npx vite build 2>&1 | tail -3 && cd ../..

echo "=== Packaging ==="
tar czf /tmp/practica-deploy.tar.gz \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='db.sqlite3' \
  --exclude='media/' --exclude='staticfiles/' --exclude='node_modules/' \
  requirements.txt apps/backend/ apps/frontend/dist/ apps/frontend/package.json \
  apps/frontend/package-lock.json apps/frontend/src/ apps/frontend/index.html \
  apps/frontend/vite.config.js apps/frontend/postcss.config.js apps/frontend/tailwind.config.js \
  scripts/

echo "=== Uploading to S3 ==="
aws s3 cp /tmp/practica-deploy.tar.gz "s3://${BUCKET}/deploy/practica-code.tar.gz" --region "$REGION" 2>&1 | tail -1
rm /tmp/practica-deploy.tar.gz

echo "=== Deploying on instance ==="
$SSH '/opt/practica/deploy-update.sh'

echo "=== Cleaning S3 ==="
aws s3 rm "s3://${BUCKET}/deploy/practica-code.tar.gz" --region "$REGION" 2>&1 | tail -1

echo ""
echo "=== Verifying ==="
curl -s https://practica.jpagan.com/health/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d[\"status\"]} | Version: {d[\"version\"]}')"
echo ""
echo "Deploy complete!"
