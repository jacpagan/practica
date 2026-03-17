SHELL := /bin/bash

.PHONY: up down restart logs ps migrate createsuperuser shell collectstatic seed nuke backend-shell frontend-shell fmt help

DC := docker compose

help:
	@echo "Common dev targets:"
	@echo "  make up             # Start all services"
	@echo "  make down           # Stop services"
	@echo "  make logs           # Tail logs"
	@echo "  make ps             # Show service status"
	@echo "  make migrate        # Run Django migrations"
	@echo "  make createsuperuser# Create Django superuser (interactive)"
	@echo "  make shell          # Django shell"
	@echo "  make collectstatic  # Collect static files"
	@echo "  make seed           # Seed demo MVP data"
	@echo "  make nuke           # Stop and remove volumes (destructive)"

up:
	$(DC) up -d

down:
	$(DC) down

restart: down up

logs:
	$(DC) logs -f --tail=200

ps:
	$(DC) ps

migrate:
	$(DC) exec backend python manage.py migrate

createsuperuser:
	$(DC) exec backend python manage.py createsuperuser

shell:
	$(DC) exec backend python manage.py shell

collectstatic:
	$(DC) exec backend python manage.py collectstatic --noinput

seed:
	$(DC) exec backend python manage.py seed_mvp

nuke:
	$(DC) down -v

