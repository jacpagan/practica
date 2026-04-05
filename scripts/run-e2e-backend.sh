#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DB_PATH="${PRACTICA_E2E_DB_PATH:-/tmp/practica-e2e.sqlite3}"
DATABASE_URL_VALUE="sqlite:///${DB_PATH}"
PORT="${PRACTICA_E2E_PORT:-8010}"
PYTHON_BIN="${PYTHON_BIN:-}"

if [ -z "$PYTHON_BIN" ]; then
  if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
  else
    PYTHON_BIN="python3"
  fi
fi

cd "$ROOT_DIR/apps/backend"

rm -f "$DB_PATH"

export DATABASE_URL="$DATABASE_URL_VALUE"
unset DB_NAME DB_USER DB_PASSWORD DB_HOST DB_PORT AWS_STORAGE_BUCKET_NAME
export DJANGO_SECRET_KEY="practica-e2e-secret"
export DJANGO_SETTINGS_MODULE="practica.settings"
export ALLOWED_HOSTS="127.0.0.1,localhost"
export DEBUG=1

"$PYTHON_BIN" manage.py migrate --noinput
"$PYTHON_BIN" manage.py runserver 127.0.0.1:${PORT}
