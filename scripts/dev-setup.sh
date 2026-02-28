#!/bin/bash

# Development Environment Setup Script
# This script sets up a production-like development environment using Docker

set -e  # Exit on any error

echo "🚀 Setting up production-like development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Create environment file template if it doesn't exist
if [ ! -f .env.development ]; then
    echo "📝 Creating .env.development template..."
    cat > .env.development << EOF
# Development Environment Variables
DEBUG=1
SECRET_KEY=dev-secret-key-not-for-production
DATABASE_URL=postgresql://practica:practica123@localhost:5432/practica
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
API_URL=http://localhost:8000
EOF
fi

# Load development environment variables
if [ -f .env.development ]; then
    export $(cat .env.development | grep -v '^#' | xargs)
    echo "✅ Loaded development environment variables"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Start development environment
echo "🐳 Starting development environment with Docker Compose..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check if backend is responding
echo "🔍 Checking backend health..."
for i in {1..30}; do
    if curl -f http://localhost:8000/admin/ > /dev/null 2>&1; then
        echo "✅ Backend is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend is not responding after 30 attempts"
        docker-compose logs backend
        exit 1
    fi
    sleep 2
done

# Run database migrations
echo "📊 Running database migrations..."
docker-compose exec -T backend python manage.py migrate

# Create superuser if it doesn't exist
echo "👤 Creating superuser..."
docker-compose exec -T backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('ℹ️ Superuser already exists')
EOF

# Run tests
echo "🧪 Running tests..."
docker-compose exec -T backend python manage.py test --verbosity=1

# Display status
echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "📋 Services:"
echo "   🌐 Backend:  http://localhost:8000"
echo "   🖥️  Frontend: http://localhost:3000"
echo "   🔧 Admin:    http://localhost:8000/admin/"
echo "   🗄️  Database: postgresql://practica:practica123@localhost:5432/practica"
echo "   🔴 Redis:    redis://localhost:6379/0"
echo ""
echo "🔑 Admin Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "💡 Useful commands:"
echo "   - View logs:     docker-compose logs -f"
echo "   - Stop services: docker-compose down"
echo "   - Restart:       docker-compose restart"
echo "   - Shell access:  docker-compose exec backend bash"
echo ""
