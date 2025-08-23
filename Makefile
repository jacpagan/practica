.PHONY: help dev-up prod-up down prod-down logs test status clean build

# Default target
help:
	@echo "LMS Docker Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make dev-up      - Start development environment"
	@echo "  make prod-up     - Start production environment"
	@echo "  make down        - Stop development services"
	@echo "  make prod-down   - Stop production services"
	@echo "  make logs        - View development logs"
	@echo "  make logs-prod   - View production logs"
	@echo "  make test        - Run test suite"
	@echo "  make status      - Show service status"
	@echo "  make clean       - Clean up all containers and images"
	@echo "  make build       - Build Docker images"
	@echo "  make shell       - Open Django shell in development"
	@echo "  make shell-prod  - Open Django shell in production"

# Development environment
dev-up:
	./docker-helper.sh dev-up

# Production environment
prod-up:
	./docker-helper.sh prod-up

# Stop development
down:
	./docker-helper.sh down

# Stop production
prod-down:
	./docker-helper.sh prod-down

# View logs
logs:
	./docker-helper.sh logs

# View production logs
logs-prod:
	./docker-helper.sh logs prod

# Run tests
test:
	./docker-helper.sh test

# Show status
status:
	./docker-helper.sh status

# Clean up
clean:
	./docker-helper.sh clean

# Build images
build:
	docker-compose build
	docker-compose -f docker-compose.prod.yml build

# Django shell (development)
shell:
	docker-compose exec web python manage.py shell

# Django shell (production)
shell-prod:
	docker-compose -f docker-compose.prod.yml exec web python manage.py shell

# Django management commands
manage:
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make manage CMD='command'"; \
		echo "Example: make manage CMD='makemigrations'"; \
		exit 1; \
	fi
	docker-compose exec web python manage.py $(CMD)

# Django management commands (production)
manage-prod:
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make manage-prod CMD='command'"; \
		echo "Example: make manage-prod CMD='makemigrations'"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml exec web python manage.py $(CMD)
