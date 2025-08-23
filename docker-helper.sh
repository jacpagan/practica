#!/bin/bash

# Docker helper script for LMS application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_status "Docker is running"
}

# Function to build and start development environment
dev_up() {
    print_status "Starting development environment..."
    check_docker
    
    # Create necessary directories if they don't exist
    mkdir -p media logs
    
    # Build and start services
    docker-compose up --build -d
    
    print_status "Development environment is starting..."
    print_status "Waiting for services to be ready..."
    
    # Wait for Django to be ready
    sleep 10
    
    # Run migrations
    docker-compose exec web python manage.py migrate
    
    # Create superuser if it doesn't exist
    docker-compose exec -T web python manage.py shell << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
EOF
    
    # Create regular user if it doesn't exist
    docker-compose exec -T web python manage.py shell << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='user').exists():
    User.objects.create_user('user', 'user@example.com', 'user123')
    print('Regular user created: user/user123')
else:
    print('Regular user already exists')
EOF
    
    print_status "Development environment is ready!"
    print_status "Access the application at: http://localhost:8000"
    print_status "Admin interface: http://localhost:8000/admin/"
    print_status "Username: admin, Password: admin123"
    print_status "Regular user: user, Password: user123"
}

# Function to start production environment
prod_up() {
    print_status "Starting production environment..."
    check_docker
    
    # Create necessary directories if they don't exist
    mkdir -p media logs staticfiles
    
    # Build and start production services
    docker-compose -f docker-compose.prod.yml up --build -d
    
    print_status "Production environment is starting..."
    print_status "Access the application at: http://localhost"
}

# Function to stop services
down() {
    print_status "Stopping services..."
    docker-compose down
    print_status "Services stopped"
}

# Function to stop production services
prod_down() {
    print_status "Stopping production services..."
    docker-compose -f docker-compose.prod.yml down
    print_status "Production services stopped"
}

# Function to view logs
logs() {
    if [ "$1" = "prod" ]; then
        docker-compose -f docker-compose.prod.yml logs -f
    else
        docker-compose logs -f
    fi
}

# Function to run Django management commands
manage() {
    if [ "$1" = "prod" ]; then
        shift
        docker-compose -f docker-compose.prod.yml exec web python manage.py "$@"
    else
        docker-compose exec web python manage.py "$@"
    fi
}

# Function to run tests
test() {
    print_status "Running tests..."
    docker-compose exec web python -m pytest tests/ -v
}

# Function to clean up
clean() {
    print_warning "This will remove all containers, images, and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up..."
        docker-compose down -v --rmi all
        docker-compose -f docker-compose.prod.yml down -v --rmi all
        docker system prune -af
        print_status "Cleanup complete"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show status
status() {
    print_status "Development environment status:"
    docker-compose ps
    
    echo ""
    print_status "Production environment status:"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    print_status "Docker system info:"
    docker system df
}

# Function to show help
show_help() {
    echo "LMS Docker Helper Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  dev-up      Build and start development environment"
    echo "  prod-up     Build and start production environment"
    echo "  down        Stop development services"
    echo "  prod-down   Stop production services"
    echo "  logs        View logs (use 'logs prod' for production)"
    echo "  manage      Run Django management commands (use 'manage prod' for production)"
    echo "  test        Run test suite"
    echo "  status      Show status of all services"
    echo "  clean       Clean up all containers, images, and volumes"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev-up           # Start development environment"
    echo "  $0 manage makemigrations  # Run makemigrations in development"
    echo "  $0 manage prod shell      # Open Django shell in production"
    echo "  $0 logs prod              # View production logs"
}

# Main script logic
case "${1:-help}" in
    "dev-up")
        dev_up
        ;;
    "prod-up")
        prod_up
        ;;
    "down")
        down
        ;;
    "prod-down")
        prod_down
        ;;
    "logs")
        logs "$2"
        ;;
    "manage")
        shift
        manage "$@"
        ;;
    "test")
        test
        ;;
    "status")
        status
        ;;
    "clean")
        clean
        ;;
    "help"|*)
        show_help
        ;;
esac
