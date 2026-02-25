#!/bin/bash

# Production Deployment Script
# This script deploys the application to production environment

set -e  # Exit on any error

echo "🚀 Deploying to production environment..."
echo "⚠️  WARNING: This will deploy to PRODUCTION!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Production deployment cancelled"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create production environment file template if it doesn't exist
if [ ! -f .env.production ]; then
    echo "📝 Creating .env.production template..."
    cat > .env.production << EOF
# Production Environment Variables - KEEP SECURE!
DEBUG=0
SECRET_KEY=your-super-secret-production-key
POSTGRES_PASSWORD=your-super-secure-production-password
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
API_URL=https://api.yourdomain.com
AWS_ACCESS_KEY_ID=your-production-aws-key
AWS_SECRET_ACCESS_KEY=your-production-aws-secret
AWS_STORAGE_BUCKET_NAME=practica-production-bucket
EOF
    echo "⚠️  Please update .env.production with your production configuration"
    echo "❌ Cannot proceed without production configuration"
    exit 1
fi

# Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "✅ Loaded production environment variables"
fi

# Validate required environment variables
required_vars=("SECRET_KEY" "POSTGRES_PASSWORD" "ALLOWED_HOSTS")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

# Create database backup before deployment
echo "💾 Creating database backup..."
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="backup_${timestamp}.sql"

if docker-compose -f docker-compose.prod.yml ps | grep -q "practica_db_1"; then
    docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U practica practica_prod > $backup_file
    echo "✅ Database backup created: $backup_file"
else
    echo "ℹ️ No existing production database found, skipping backup"
fi

# Stop existing production containers
echo "🛑 Stopping existing production containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build and start production environment
echo "🐳 Building and starting production environment..."
docker-compose -f docker-compose.prod.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if backend is responding
echo "🔍 Checking production backend health..."
for i in {1..60}; do
    if curl -f http://localhost:8000/admin/ > /dev/null 2>&1; then
        echo "✅ Production backend is responding"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "❌ Production backend is not responding after 60 attempts"
        docker-compose -f docker-compose.prod.yml logs backend
        exit 1
    fi
    sleep 2
done

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# Create superuser if it doesn't exist (production)
echo "👤 Creating production superuser..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@production.com', 'admin123')
    print('✅ Production superuser created: admin/admin123')
else:
    print('ℹ️ Production superuser already exists')
EOF

# Run critical tests in production environment
echo "🧪 Running critical tests in production environment..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py test --verbosity=1 --failfast

# Health check
echo "🏥 Running production health check..."
if curl -f http://localhost:8000/admin/ > /dev/null 2>&1; then
    echo "✅ Production health check passed"
else
    echo "❌ Production health check failed"
    echo "🔄 Rolling back..."
    docker-compose -f docker-compose.prod.yml down
    exit 1
fi

# Display status
echo ""
echo "🎉 Production deployment complete!"
echo ""
echo "📋 Production Services:"
echo "   🌐 Backend:  http://localhost:8000"
echo "   🖥️  Frontend: http://localhost:3000"
echo "   🔧 Admin:    http://localhost:8000/admin/"
echo ""
echo "🔑 Admin Login:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "💡 Production Management:"
echo "   - View logs:     docker-compose -f docker-compose.prod.yml logs -f"
echo "   - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "   - Restart:       docker-compose -f docker-compose.prod.yml restart"
echo "   - Shell access:  docker-compose -f docker-compose.prod.yml exec backend bash"
echo ""
echo "🔒 Security Reminders:"
echo "   - Change default admin password"
echo "   - Review firewall settings"
echo "   - Monitor application logs"
echo "   - Set up SSL/TLS certificates"
echo ""
