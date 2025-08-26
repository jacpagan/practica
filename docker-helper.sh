#!/usr/bin/env bash
set -e

COMMAND="$1"
TARGET="$2"

case "$COMMAND" in
  dev-up)
    docker-compose up -d
    ;;
  prod-up)
    docker-compose -f docker-compose.prod.yml up -d
    ;;
  down)
    docker-compose down
    ;;
  prod-down)
    docker-compose -f docker-compose.prod.yml down
    ;;
  logs)
    if [ "$TARGET" = "prod" ]; then
      docker-compose -f docker-compose.prod.yml logs -f
    else
      docker-compose logs -f
    fi
    ;;
  test)
    docker-compose run --rm web pytest
    ;;
  status)
    echo "Development services:" && docker-compose ps
    echo "Production services:" && docker-compose -f docker-compose.prod.yml ps
    ;;
  clean)
    docker-compose down -v
    docker-compose -f docker-compose.prod.yml down -v
    ;;
  *)
    echo "Usage: $0 {dev-up|prod-up|down|prod-down|logs [prod]|test|status|clean}"
    exit 1
    ;;
esac
