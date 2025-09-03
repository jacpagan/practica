# Practika Beta Makefile
# Simplified development and deployment commands

.PHONY: help dev-up dev-down test lint migrate seed clean

# Default target
help:
	@echo "Practika Beta Development Commands"
	@echo "=================================="
	@echo "dev-up          - Start local development environment"
	@echo "dev-down        - Stop local development environment"
	@echo "test            - Run all tests"
	@echo "lint            - Run linting"
	@echo "migrate         - Run database migrations"
	@echo "seed            - Seed database with sample data"
	@echo "clean           - Clean up generated files"
	@echo "deploy          - Deploy to production"

# Development environment
dev-up:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	sleep 10
	@echo "Running database migrations..."
	docker-compose exec backend python manage.py migrate
	@echo "Development environment ready!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8000"
	@echo "Admin:    http://localhost:8000/admin"

dev-down:
	@echo "Stopping development environment..."
	docker-compose down
	@echo "Development environment stopped."

# Testing
test:
	@echo "Running all tests..."
	@echo "Backend tests..."
	docker-compose exec backend python manage.py test
	@echo "Frontend tests..."
	docker-compose exec frontend npm test
	@echo "All tests completed!"

# Code quality
lint:
	@echo "Running linting..."
	@echo "Backend linting..."
	docker-compose exec backend flake8 .
	@echo "Frontend linting..."
	docker-compose exec frontend npm run lint
	@echo "Linting completed!"

# Database operations
migrate:
	@echo "Running database migrations..."
	docker-compose exec backend python manage.py makemigrations
	docker-compose exec backend python manage.py migrate
	@echo "Migrations completed!"

seed:
	@echo "Seeding database with sample data..."
	docker-compose exec backend python manage.py loaddata initial_data
	@echo "Database seeded!"

# Deployment (Simplified for Beta)
deploy:
	@echo "Deploying to production..."
	@echo "Building and pushing backend..."
	cd apps/backend && docker build -t practika-backend:beta . && docker push practika-backend:beta
	@echo "Building and deploying frontend..."
	cd apps/frontend && npm run build && aws s3 sync dist/ s3://practika-beta --delete
	@echo "Deployment completed!"

# Utilities
shell:
	docker-compose exec backend python manage.py shell

superuser:
	docker-compose exec backend python manage.py createsuperuser

logs:
	docker-compose logs -f

clean:
	@echo "Cleaning up..."
	docker-compose down -v
	docker system prune -f
	@echo "Cleanup completed!"
