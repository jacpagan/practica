# Practika v1 Runbook

## Mission
Health endpoint that requires no DB/S3. Structured error logging to stdout. Short runbook describing env vars, storage switch (local vs S3), and smoke checks.

## Environment Variables

### Required Environment Variables
```bash
# Django Configuration
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=False
DJANGO_ENVIRONMENT=production
DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# Database Configuration
DJANGO_DB_ENGINE=django.db.backends.postgresql
DJANGO_DB_NAME=practika_prod
DJANGO_DB_USER=practika_user
DJANGO_DB_PASSWORD=your-db-password
DJANGO_DB_HOST=your-db-host
DJANGO_DB_PORT=5432

# Storage Configuration
USE_S3=True
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=your-s3-bucket
AWS_S3_REGION_NAME=us-east-1
AWS_S3_CUSTOM_DOMAIN=your-cdn-domain.com

# CORS Configuration
DJANGO_CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Optional Environment Variables
```bash
# File Upload Limits
DJANGO_FILE_UPLOAD_MAX_MEMORY_SIZE=104857600  # 100MB
DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE=104857600  # 100MB

# Static Files
DJANGO_STATIC_ROOT=/app/staticfiles
DJANGO_MEDIA_ROOT=/app/media

# Logging
DJANGO_LOG_LEVEL=INFO
```

### Development Environment Variables
```bash
# Local Development
DJANGO_DEBUG=True
DJANGO_ENVIRONMENT=development
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
USE_S3=False
DJANGO_DB_ENGINE=django.db.backends.sqlite3
DJANGO_DB_NAME=db.sqlite3
```

## Storage Configuration

### Local Storage (Development)
```python
# settings.py
USE_S3 = os.getenv('USE_S3', 'False').lower() == 'true'

if not USE_S3:
    # Local file system storage
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'
    
    # Simple file storage
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
```

### S3 Storage (Production)
```python
# settings.py
if USE_S3:
    # S3 storage configuration
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN')
    
    # S3 storage backend
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    
    # S3 settings
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = 'public-read'
    AWS_QUERYSTRING_AUTH = False
```

### Storage Service Interface
```python
# core/services/storage.py
class VideoStorageService:
    def __init__(self):
        self.backend = self._get_backend()
    
    def _get_backend(self):
        from django.conf import settings
        if getattr(settings, 'USE_S3', False):
            return S3StorageBackend()
        return LocalStorageBackend()
    
    def upload_video(self, file_obj, filename):
        return self.backend.upload(file_obj, filename)
    
    def get_video_url(self, video_asset):
        return self.backend.get_url(video_asset.storage_path)
    
    def delete_video(self, storage_path):
        return self.backend.delete(storage_path)
```

## Health Check Endpoint

### Simple Health Check
```python
# core/views.py
from django.http import JsonResponse
import time

def health_check(request):
    """Simple health check endpoint - no DB/S3 dependency"""
    start_time = time.time()
    
    try:
        # Basic system check
        health_data = {
            'status': 'healthy',
            'timestamp': time.time(),
            'version': '1.0.0',
            'environment': os.getenv('DJANGO_ENVIRONMENT', 'unknown'),
        }
        
        # Calculate response time
        response_time = (time.time() - start_time) * 1000
        health_data['response_time_ms'] = round(response_time, 2)
        
        return JsonResponse(health_data, status=200)
        
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': time.time()
        }, status=500)
```

### Health Check URL
```
GET /core/health/
```

### Expected Response
```json
{
    "status": "healthy",
    "timestamp": 1640995200.123,
    "version": "1.0.0",
    "environment": "production",
    "response_time_ms": 0.45
}
```

## Logging Configuration

### Simple Logging Setup
```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'json': {
            'format': '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'json' if not DEBUG else 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'exercises': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'comments': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

### Log Output Examples
```json
{"timestamp": "2024-01-01 12:00:00,000", "level": "INFO", "logger": "core.views", "message": "Video upload started: test_video.mp4"}
{"timestamp": "2024-01-01 12:00:01,000", "level": "INFO", "logger": "core.views", "message": "Video upload completed: test_video.mp4"}
{"timestamp": "2024-01-01 12:00:02,000", "level": "ERROR", "logger": "django.request", "message": "Internal Server Error: /exercises/create/"}
```

## Deployment Commands

### Local Development
```bash
# Install dependencies
pip install -r requirements-v1.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# Run tests
pytest
```

### Production Deployment
```bash
# Install dependencies
pip install -r requirements-v1.txt

# Collect static files
python manage.py collectstatic --noinput

# Run migrations
python manage.py migrate

# Start production server
gunicorn practika_project.wsgi:application --bind 0.0.0.0:8000
```

### Docker Deployment
```bash
# Build image
docker build -t practika:v1 .

# Run container
docker run -d \
  -p 8000:8000 \
  -e DJANGO_SECRET_KEY=your-secret \
  -e USE_S3=True \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  practika:v1
```

## Smoke Checks

### Basic Health Check
```bash
# Check health endpoint
curl -f http://localhost:8000/core/health/

# Expected: 200 OK with JSON response
```

### Application Startup
```bash
# Check application logs
docker logs practika-container

# Expected: No errors, successful startup
```

### Database Connection
```bash
# Check database connection
python manage.py check --database default

# Expected: No errors
```

### Static Files
```bash
# Check static files
curl -f http://localhost:8000/static/css/base.css

# Expected: 200 OK with CSS content
```

### Video Upload Test
```bash
# Test video upload (requires authentication)
curl -X POST \
  -H "Content-Type: multipart/form-data" \
  -F "video=@test_video.mp4" \
  -F "name=Test Exercise" \
  -F "description=Test Description" \
  http://localhost:8000/core/api/upload-video/

# Expected: 401 Unauthorized (requires login)
```

## Monitoring and Alerts

### Health Check Monitoring
```bash
# Simple health check script
#!/bin/bash
HEALTH_URL="http://localhost:8000/core/health/"
MAX_RESPONSE_TIME=1000  # 1 second

response=$(curl -s -w "%{http_code} %{time_total}" "$HEALTH_URL")
http_code=$(echo $response | awk '{print $1}')
response_time=$(echo $response | awk '{print $2}')

if [ "$http_code" != "200" ]; then
    echo "ERROR: Health check failed with HTTP $http_code"
    exit 1
fi

if (( $(echo "$response_time > $MAX_RESPONSE_TIME" | bc -l) )); then
    echo "WARNING: Health check slow: ${response_time}s"
    exit 1
fi

echo "OK: Health check passed in ${response_time}s"
```

### Log Monitoring
```bash
# Check for errors in logs
grep -i "error\|exception\|traceback" /var/log/practika/app.log

# Check for slow responses
grep "response_time_ms" /var/log/practika/app.log | awk '$NF > 1000'
```

## Troubleshooting

### Common Issues

#### 1. Health Check Failing
**Symptoms**: Health endpoint returns 500 or timeout
**Diagnosis**: Check application logs
**Solution**: Verify Django settings, check for import errors

#### 2. Video Upload Failing
**Symptoms**: Upload returns error or timeout
**Diagnosis**: Check storage configuration
**Solution**: Verify S3 credentials or local storage permissions

#### 3. Database Connection Issues
**Symptoms**: Application errors, migration failures
**Diagnosis**: Check database logs and connection
**Solution**: Verify database credentials and connectivity

#### 4. Static Files Not Loading
**Symptoms**: CSS/JS files return 404
**Diagnosis**: Check static file collection
**Solution**: Run `python manage.py collectstatic`

### Debug Commands
```bash
# Check Django configuration
python manage.py check

# Check database
python manage.py dbshell

# Check installed apps
python manage.py shell -c "from django.conf import settings; print(settings.INSTALLED_APPS)"

# Check middleware
python manage.py shell -c "from django.conf import settings; print(settings.MIDDLEWARE)"
```

## Performance Targets

### Response Times
- **Health check**: < 100ms
- **Static files**: < 50ms
- **Exercise list**: < 500ms
- **Exercise detail**: < 1000ms
- **Video upload**: < 5000ms (depends on file size)

### Resource Usage
- **Memory**: < 512MB per process
- **CPU**: < 80% under normal load
- **Disk**: < 1GB for application files
- **Network**: < 100MB/s for video uploads

## Security Checklist

### Basic Security
- [ ] HTTPS enabled in production
- [ ] Secret key is secure and unique
- [ ] Debug mode disabled in production
- [ ] Allowed hosts configured correctly
- [ ] CORS settings appropriate for production

### File Security
- [ ] File upload size limits configured
- [ ] File type validation enabled
- [ ] S3 bucket permissions configured correctly
- [ ] Media files not publicly accessible

### Authentication
- [ ] Session security enabled
- [ ] CSRF protection enabled
- [ ] Password validation configured
- [ ] Admin interface secured

## Backup and Recovery

### Database Backup
```bash
# PostgreSQL backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup.sql

# SQLite backup
cp db.sqlite3 backup_$(date +%Y%m%d).sqlite3
```

### File Backup
```bash
# S3 backup (if using S3)
aws s3 sync s3://your-bucket s3://your-backup-bucket

# Local backup
tar -czf media_backup_$(date +%Y%m%d).tar.gz media/
```

### Recovery Process
1. Restore database from backup
2. Restore media files
3. Run migrations if needed
4. Verify application functionality
5. Check health endpoint

## Success Criteria

### Functional Requirements
- Health endpoint returns 200 in < 100ms
- No database dependency for health check
- Structured logging to stdout
- Clear environment variable documentation
- Simple storage switching (local vs S3)

### Non-Functional Requirements
- Fast application startup
- Minimal resource usage
- Clear error messages
- Easy troubleshooting
- Simple deployment process

### Operational Requirements
- Clear runbook documentation
- Simple smoke checks
- Basic monitoring
- Easy troubleshooting
- Fast recovery process
