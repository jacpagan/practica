#!/bin/bash

# Simple Docker test script for Practika application

echo "🐳 Testing Practika Docker Setup"
echo "============================"

# Check if Docker is running
echo "1. Checking Docker status..."
if docker info > /dev/null 2>&1; then
    echo "✅ Docker is running"
else
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check Docker Compose
echo "2. Checking Docker Compose..."
if docker-compose --version > /dev/null 2>&1; then
    echo "✅ Docker Compose is available"
else
    echo "❌ Docker Compose is not available"
    exit 1
fi

# Create necessary directories
echo "3. Creating necessary directories..."
mkdir -p media logs
echo "✅ Directories created"

# Build and start services
echo "4. Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "5. Waiting for services to be ready..."
sleep 15

# Check service status
echo "6. Checking service status..."
docker-compose ps

# Check if Django is responding
echo "7. Testing Django application..."
if curl -s http://localhost:8000/health/ > /dev/null; then
    echo "✅ Django application is responding"
else
    echo "⚠️  Django application is not responding yet, waiting..."
    sleep 10
    if curl -s http://localhost:8000/health/ > /dev/null; then
        echo "✅ Django application is now responding"
    else
        echo "❌ Django application is not responding"
        echo "Checking logs..."
        docker-compose logs web
        exit 1
    fi
fi

# Run migrations
echo "8. Running database migrations..."
docker-compose exec -T web python manage.py migrate

# Create superuser if it doesn't exist
echo "9. Setting up default users..."
docker-compose exec -T web python manage.py shell << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('ℹ️  Superuser already exists')
EOF

# Create regular user if it doesn't exist
docker-compose exec -T web python manage.py shell << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='user').exists():
    User.objects.create_user('user', 'user@example.com', 'user123')
    print('✅ Regular user created: user/user123')
else:
    print('ℹ️  Regular user already exists')
EOF

# Test API endpoints
echo "10. Testing API endpoints..."
if curl -s http://localhost:8000/api/ > /dev/null; then
    echo "✅ API is accessible"
else
    echo "❌ API is not accessible"
fi

# Final status
echo ""
echo "🎉 Docker setup test completed!"
echo ""
echo "📱 Access your application:"
echo "   Main app: http://localhost:8000"
echo "   Admin: http://localhost:8000/admin/"
echo "   Health: http://localhost:8000/health/"
echo ""
echo "👤 Default users:"
echo "   Admin: admin / admin123"
echo "   User: user / user123"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart: docker-compose restart"
echo "   Shell: docker-compose exec web python manage.py shell"
echo ""
echo "🧪 Run tests:"
echo "   docker-compose exec web python -m pytest tests/ -v"
