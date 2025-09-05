# Production-Like Development Environment Setup

## 🚀 **Quick Start Guide**

### **Step 1: Development Environment**
```bash
# Start full stack with Docker
docker-compose up --build

# This gives you:
# - Backend: http://localhost:8000
# - Frontend: http://localhost:3000  
# - Database: PostgreSQL on port 5432
# - Cache: Redis on port 6379
```

### **Step 2: Staging Environment**
```bash
# Deploy to staging (production-like)
docker-compose -f docker-compose.staging.yml up -d

# Run production-like tests
docker-compose -f docker-compose.staging.yml exec backend python manage.py test --settings=practica.staging
```

### **Step 3: Production Deployment**
```bash
# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Health check
curl http://your-production-url/health/
```

## 🔧 **Required Configuration Files**

### **1. Development Docker Compose** (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: practica_dev
      POSTGRES_USER: practica
      POSTGRES_PASSWORD: practica123
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      - DEBUG=1
      - DATABASE_URL=postgresql://practica:practica123@db:5432/practica_dev
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./apps/backend:/app
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    command: >
      sh -c "python manage.py migrate &&
             python manage.py runserver 0.0.0.0:8000"

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=http://localhost:8000
    volumes:
      - ./apps/frontend:/app
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_dev_data:
```

### **2. Staging Docker Compose** (`docker-compose.staging.yml`)
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: practica_staging
      POSTGRES_USER: practica
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5433:5432"
    volumes:
      - postgres_staging_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      - DEBUG=0
      - DATABASE_URL=postgresql://practica:${POSTGRES_PASSWORD}@db:5432/practica_staging
      - REDIS_URL=redis://redis:6379/0
      - ALLOWED_HOSTS=localhost,staging.yourdomain.com
    volumes:
      - ./apps/backend:/app
    ports:
      - "8001:8000"
    depends_on:
      - db
      - redis
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             python manage.py runserver 0.0.0.0:8000"

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=http://localhost:8001
    volumes:
      - ./apps/frontend:/app
    ports:
      - "3001:3000"
    depends_on:
      - backend

volumes:
  postgres_staging_data:
```

### **3. Production Docker Compose** (`docker-compose.prod.yml`)
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: practica_prod
      POSTGRES_USER: practica
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_prod_data:/data
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      - DEBUG=0
      - DATABASE_URL=postgresql://practica:${POSTGRES_PASSWORD}@db:5432/practica_prod
      - REDIS_URL=redis://redis:6379/0
      - ALLOWED_HOSTS=${ALLOWED_HOSTS}
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - media_volume:/app/media
      - static_volume:/app/staticfiles
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    restart: unless-stopped
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             python manage.py runserver 0.0.0.0:8000"

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=${API_URL}
    volumes:
      - ./apps/frontend:/app
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_prod_data:
  redis_prod_data:
  media_volume:
  static_volume:
```

## 🔧 **Environment Configuration Files**

### **Development Environment** (`.env.development`)
```bash
# Development Environment Variables
DEBUG=1
SECRET_KEY=dev-secret-key-not-for-production
DATABASE_URL=postgresql://practica:practica123@localhost:5432/practica_dev
REDIS_URL=redis://localhost:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
```

### **Staging Environment** (`.env.staging`)
```bash
# Staging Environment Variables
DEBUG=0
SECRET_KEY=staging-secret-key
POSTGRES_PASSWORD=staging-password-123
DATABASE_URL=postgresql://practica:staging-password-123@localhost:5433/practica_staging
REDIS_URL=redis://localhost:6380/0
ALLOWED_HOSTS=localhost,staging.yourdomain.com
```

### **Production Environment** (`.env.production`)
```bash
# Production Environment Variables
DEBUG=0
SECRET_KEY=your-super-secret-production-key
POSTGRES_PASSWORD=your-super-secure-production-password
DATABASE_URL=postgresql://practica:your-super-secure-production-password@db:5432/practica_prod
REDIS_URL=redis://redis:6379/0
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
API_URL=https://api.yourdomain.com
```

## 🚀 **Deployment Scripts**

### **Development Setup** (`scripts/dev-setup.sh`)
```bash
#!/bin/bash

echo "🚀 Setting up development environment..."

# Load development environment variables
export $(cat .env.development | xargs)

# Start development environment
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Run database migrations
echo "📊 Running database migrations..."
docker-compose exec backend python manage.py migrate

# Create superuser if it doesn't exist
echo "👤 Creating superuser..."
docker-compose exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"

# Run tests
echo "🧪 Running tests..."
docker-compose exec backend python manage.py test

echo "✅ Development environment ready!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Admin: http://localhost:8000/admin/"
```

### **Staging Deployment** (`scripts/staging-deploy.sh`)
```bash
#!/bin/bash

echo "🚀 Deploying to staging..."

# Load staging environment variables
export $(cat .env.staging | xargs)

# Stop existing staging containers
docker-compose -f docker-compose.staging.yml down

# Build and start staging environment
docker-compose -f docker-compose.staging.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.staging.yml exec backend python manage.py migrate --settings=practica.staging

# Collect static files
echo "📁 Collecting static files..."
docker-compose -f docker-compose.staging.yml exec backend python manage.py collectstatic --noinput --settings=practica.staging

# Run tests
echo "🧪 Running tests..."
docker-compose -f docker-compose.staging.yml exec backend python manage.py test --settings=practica.staging

echo "✅ Staging deployment complete!"
echo "Backend: http://localhost:8001"
echo "Frontend: http://localhost:3001"
```

### **Production Deployment** (`scripts/prod-deploy.sh`)
```bash
#!/bin/bash

echo "🚀 Deploying to production..."

# Load production environment variables
export $(cat .env.production | xargs)

# Create backup before deployment
echo "💾 Creating database backup..."
docker-compose -f docker-compose.prod.yml exec db pg_dump -U practica practica_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Stop existing production containers
docker-compose -f docker-compose.prod.yml down

# Build and start production environment
docker-compose -f docker-compose.prod.yml up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 20

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# Health check
echo "🏥 Running health check..."
curl -f http://localhost:8000/health/ || exit 1

echo "✅ Production deployment complete!"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
```

## 🧪 **Testing Strategy**

### **Unit Tests** (`tests/unit/test_models.py`)
```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from videos.models import ExerciseVideo, PracticeThread

User = get_user_model()

class ExerciseVideoModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_exercise_video_creation(self):
        video = ExerciseVideo.objects.create(
            title='Test Video',
            description='Test Description',
            user=self.user
        )
        self.assertEqual(video.title, 'Test Video')
        self.assertEqual(video.user, self.user)
```

### **Integration Tests** (`tests/integration/test_api.py`)
```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class VideoAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_video_creation(self):
        data = {
            'title': 'Test Video',
            'description': 'Test Description'
        }
        response = self.client.post('/api/videos/upload/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

### **End-to-End Tests** (`tests/e2e/test_user_flow.py`)
```python
from django.test import TestCase
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

class UserFlowTest(TestCase):
    def setUp(self):
        self.driver = webdriver.Chrome()
    
    def test_complete_user_flow(self):
        # Navigate to frontend
        self.driver.get('http://localhost:3000')
        
        # Upload video
        upload_button = self.driver.find_element(By.ID, 'upload-button')
        upload_button.click()
        
        # Add practice session
        practice_button = self.driver.find_element(By.ID, 'practice-button')
        practice_button.click()
        
        # Verify video appears
        video_element = self.driver.find_element(By.CLASS_NAME, 'video-item')
        self.assertTrue(video_element.is_displayed())
    
    def tearDown(self):
        self.driver.quit()
```

## 📊 **Monitoring and Health Checks**

### **Health Check Endpoint** (`apps/backend/videos/views.py`)
```python
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import redis

def health_check(request):
    """Health check endpoint for monitoring"""
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {}
    }
    
    # Check database
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status['services']['database'] = 'healthy'
    except Exception as e:
        health_status['services']['database'] = f'unhealthy: {str(e)}'
        health_status['status'] = 'unhealthy'
    
    # Check Redis
    try:
        cache.set('health_check', 'ok', 10)
        cache.get('health_check')
        health_status['services']['redis'] = 'healthy'
    except Exception as e:
        health_status['services']['redis'] = f'unhealthy: {str(e)}'
        health_status['status'] = 'unhealthy'
    
    return JsonResponse(health_status)
```

## 🔄 **Daily Workflow Commands**

### **Morning Setup**
```bash
# Pull latest changes
git pull origin main

# Start development environment
docker-compose up -d

# Run tests
docker-compose exec backend python manage.py test

# Check staging
docker-compose -f docker-compose.staging.yml up -d
```

### **During Development**
```bash
# Make changes locally
# Test in Docker environment
docker-compose exec backend python manage.py test

# Deploy to staging for validation
./scripts/staging-deploy.sh

# Get feedback from staging environment
curl http://localhost:8001/health/
```

### **Before Production**
```bash
# Run full test suite in staging
docker-compose -f docker-compose.staging.yml exec backend python manage.py test --settings=practica.staging

# Deploy to production
./scripts/prod-deploy.sh

# Monitor production health
curl http://your-production-url/health/
```

## 🎯 **Success Metrics Dashboard**

### **Deployment Metrics**
- **Deployment Frequency**: Daily deployments to staging
- **Lead Time**: < 1 hour from code to staging
- **Mean Time to Recovery**: < 30 minutes
- **Change Failure Rate**: < 5%

### **Quality Metrics**
- **Test Coverage**: > 80%
- **Code Quality**: No critical issues
- **Performance**: < 2s response time
- **Security**: No high-severity vulnerabilities

This workflow ensures your development environment closely mirrors production, enabling faster iterations and more reliable deployments! 🚀