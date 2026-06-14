#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

cd "$ROOT_DIR"

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

echo "[core-loop] running focused backend regression suite"
cd apps/backend
env -u DATABASE_URL -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT \
  python manage.py test \
    videos.tests.test_auth_onboarding \
    videos.tests.test_core_loop_protection \
    videos.tests.test_feedback_requests \
    videos.tests.test_loop_metrics \
    videos.tests.test_multipart_uploads \
    videos.tests.test_review_feedback \
    videos.tests.test_v1_video_features \
    -v 1

echo "[core-loop] running recorder, upload identity, and progress unit tests"
cd ../frontend
npm run test:core-unit

echo "[core-loop] building frontend"
npm run build

echo "[core-loop] pass"
