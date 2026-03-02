#!/bin/bash

# WARNING: Non-canonical helper script.
# This script is NOT part of official CI/CD release strategy.
# Official strategy is main -> production only.

# Staging Deployment Script
# This script deploys the application to a production-like staging environment

set -e  # Exit on any error

echo "WARNING: scripts/staging-deploy.sh is local-only and not part of official release CI/CD."
echo "🚀 Deploying to staging environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create staging environment file template if it doesn't exist
if [ ! -f .env.staging ]; then
    echo "📝 Creating .env.staging template..."
    cat > .env.staging << EOF
# Staging Environment Variables
DEBUG=0
SECRET_KEY=staging-secret-key-change-me
POSTGRES_PASSWORD=staging-password-123
ALLOWED_HOSTS=localhost,127.0.0.1,staging.yourdomain.com
API_URL=http://localhost:8001
EOF
    echo "⚠️  Please update .env.staging with your staging configuration"
fi

# Load staging environment variables
if [ -f .env.staging ]; then
    export $(cat .env.staging | grep -v '^#' | xargs)
    echo "✅ Loaded staging environment variables"
fi

# Stop existing staging containers
echo "🛑 Stopping existing staging containers..."
docker-compose -f docker-compose.staging.yml down 2>/dev/null || true

# Build and start staging environment
echo "🐳 Building and starting staging environment..."
docker-compose -f docker-compose.staging.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 20

# Check if backend is responding
echo "🔍 Checking staging backend health..."
for i in {1..30}; do
    if curl -f http://localhost:8001/admin/ > /dev/null 2>&1; then
        echo "✅ Staging backend is responding"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Staging backend is not responding after 30 attempts"
        docker-compose -f docker-compose.staging.yml logs backend
        exit 1
    fi
    sleep 2
done

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.staging.yml exec -T backend python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
docker-compose -f docker-compose.staging.yml exec -T backend python manage.py collectstatic --noinput

# Create superuser if it doesn't exist
echo "👤 Creating staging superuser..."
docker-compose -f docker-compose.staging.yml exec -T backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@staging.com', 'admin123')
    print('✅ Staging superuser created: admin/admin123')
else:
    print('ℹ️ Staging superuser already exists')
EOF

# Run tests in staging environment
echo "🧪 Running tests in staging environment..."
docker-compose -f docker-compose.staging.yml exec -T backend python manage.py test --verbosity=1

# Health check
echo "🏥 Running health check..."
if curl -f http://localhost:8001/admin/ > /dev/null 2>&1; then
    echo "✅ Staging health check passed"
else
    echo "❌ Staging health check failed"
    exit 1
fi

# Display status
echo ""
echo "🎉 Staging deployment complete!"
echo ""
echo "📋 Staging Services:"
echo "   🌐 Backend:  http://localhost:8001"
echo "   🖥️  Frontend: http://localhost:3001"
echo "   🔧 Admin:    http://localhost:8001/admin/"
echo "   🗄️  Database: postgresql://practica:staging-password-123@localhost:5433/practica_staging"
echo "   🔴 Redis:    redis://localhost:6380/0"
echo ""
echo "🔑 Admin Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.staging.yml ps

echo ""
echo "💡 Useful commands:"
echo "   - View logs:     docker-compose -f docker-compose.staging.yml logs -f"
echo "   - Stop services: docker-compose -f docker-compose.staging.yml down"
echo "   - Restart:       docker-compose -f docker-compose.staging.yml restart"
echo "   - Shell access:  docker-compose -f docker-compose.staging.yml exec backend bash"
echo ""
