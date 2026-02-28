#!/usr/bin/env bash
set -euo pipefail

DC=${DC:-docker-compose}

usage() {
  cat <<EOF
Usage: scripts/dev.sh <command>

Commands:
  up                Start all services
  down              Stop services
  logs              Tail logs
  ps                Show service status
  migrate           Run Django migrations
  createsuperuser   Create Django superuser (interactive)
  shell             Open Django shell
  collectstatic     Collect static files
  nuke              Stop and remove volumes (destructive)
EOF
}

cmd=${1:-}
case "$cmd" in
  up)                exec $DC up -d ;;
  down)              exec $DC down ;;
  logs)              exec $DC logs -f --tail=200 ;;
  ps)                exec $DC ps ;;
  migrate)           exec $DC exec backend python manage.py migrate ;;
  createsuperuser)   exec $DC exec backend python manage.py createsuperuser ;;
  shell)             exec $DC exec backend python manage.py shell ;;
  collectstatic)     exec $DC exec backend python manage.py collectstatic --noinput ;;
  nuke)               $DC down -v ;;
  *) usage; exit 1 ;;
esac

