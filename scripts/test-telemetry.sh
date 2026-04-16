#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

cd "$ROOT_DIR"

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

echo "[telemetry] running backend ProductEvent contract tests"
cd apps/backend
env -u DATABASE_URL -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT \
  python manage.py test \
    videos.tests.test_client_errors \
    videos.tests.test_reviewer_invites \
    videos.tests.test_review_feedback \
    -v 1

echo "[telemetry] pass"

