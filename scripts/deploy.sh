#!/bin/bash
# Deploy Practica to EC2 — run from local machine or CI
# Usage: ./scripts/deploy.sh
#
# Prerequisites:
# - AWS CLI configured
# - EC2 instance running with tag Name=practica-web
# - S3 bucket practica-media-jpagan exists

set -e

REGION="us-east-1"
BUCKET="practica-media-jpagan"
BRANCH="${1:-cursor/development-environment-setup-2b36}"
REPO="https://github.com/jacpagan/practica.git"

echo "=== Building frontend ==="
cd "$(dirname "$0")/.."
cd apps/frontend && npm install && npx vite build && cd ../..

echo "=== Packaging ==="
tar czf /tmp/practica-deploy.tar.gz \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='db.sqlite3' \
  --exclude='media/' --exclude='staticfiles/' --exclude='node_modules/' \
  requirements.txt apps/backend/ apps/frontend/dist/ apps/frontend/package.json \
  apps/frontend/package-lock.json apps/frontend/src/ apps/frontend/index.html \
  apps/frontend/vite.config.js apps/frontend/postcss.config.js apps/frontend/tailwind.config.js

echo "=== Uploading to S3 ==="
aws s3 cp /tmp/practica-deploy.tar.gz "s3://${BUCKET}/deploy/practica-code.tar.gz" --region "$REGION"

echo "=== Getting instance ID ==="
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=practica-web" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text --region "$REGION")

echo "Instance: $INSTANCE_ID"

echo "=== Done ==="
echo "Code uploaded to S3. To complete deploy, SSH into the instance and run:"
echo "  cd /opt/practica"
echo "  sudo aws s3 cp s3://${BUCKET}/deploy/practica-code.tar.gz /tmp/code.tar.gz"
echo "  sudo tar xzf /tmp/code.tar.gz -C /opt/practica"
echo "  sudo chown -R ubuntu:ubuntu /opt/practica"
echo "  cd apps/backend && ../../.venv/bin/python manage.py migrate && ../../.venv/bin/python manage.py collectstatic --noinput"
echo "  sudo systemctl restart practica"
