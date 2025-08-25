# 🐳 Docker Video Upload System Guide

## 🎯 **Overview**

This guide covers deploying and using the video upload system with your **Docker + Heroku + S3** infrastructure. The system is designed to work seamlessly across all environments.

## 🚀 **Quick Start with Docker**

### **1. Local Development**
```bash
# Start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f web

# Test the system
./docker_test.sh
```

### **2. Production Build**
```bash
# Build production image
docker-compose -f docker-compose.prod.yml up -d --build

# Check production status
docker-compose -f docker-compose.prod.yml ps
```

## 🔧 **Environment Configuration**

### **Create Environment File**
```bash
# Copy template
cp docker.env.template .env

# Edit with your values
nano .env
```

### **Required Environment Variables**
```bash
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ENVIRONMENT=production
DJANGO_DEBUG=False

# AWS S3 (Required for video uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_STORAGE_BUCKET_NAME=your-s3-bucket-name
AWS_S3_REGION_NAME=us-east-1

# Video Upload Settings
MAX_UPLOAD_SIZE=104857600
UPLOAD_RATE_LIMIT=10/minute
RATE_LIMIT_ENABLED=True
```

## 🐳 **Docker Configuration**

### **Development (docker-compose.yml)**
- **Port**: 8000
- **Environment**: Development
- **Storage**: Local media directory
- **S3**: Optional (fallback to local)

### **Production (docker-compose.prod.yml)**
- **Port**: 8000
- **Environment**: Production
- **Storage**: S3 primary, local fallback
- **S3**: Required
- **Replicas**: 2 web containers
- **Resources**: 512MB memory, 0.5 CPU

### **Dockerfile Features**
- **Base**: Python 3.11 slim
- **Dependencies**: gcc, libmagic, ffmpeg
- **Permissions**: Proper media directory setup
- **Health Check**: Django deployment check
- **User**: Non-root app user

## 🌐 **S3 Integration**

### **S3 Bucket Setup**
1. **Create S3 Bucket** in your preferred region
2. **Set CORS Policy**:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

3. **Bucket Policy** (for public read access):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### **S3 Configuration in Django**
```python
# Automatic S3 detection
if AWS_STORAGE_BUCKET_NAME:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
else:
    # Fallback to local storage
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
```

## 🚀 **Heroku Deployment**

### **1. Deploy with Docker**
```bash
# Use your existing deployment script
./deploy-heroku.sh
```

### **2. Set Environment Variables**
```bash
# Set S3 credentials
heroku config:set AWS_ACCESS_KEY_ID=your-key --app your-app-name
heroku config:set AWS_SECRET_ACCESS_KEY=your-secret --app your-app-name
heroku config:set AWS_STORAGE_BUCKET_NAME=your-bucket --app your-app-name
heroku config:set AWS_S3_REGION_NAME=us-east-1 --app your-app-name

# Set Django settings
heroku config:set DJANGO_SECRET_KEY=your-secret-key --app your-app-name
heroku config:set DJANGO_ENVIRONMENT=production --app your-app-name
heroku config:set DJANGO_DEBUG=False --app your-app-name

# Set video upload settings
heroku config:set MAX_UPLOAD_SIZE=104857600 --app your-app-name
heroku config:set UPLOAD_RATE_LIMIT=10/minute --app your-app-name
heroku config:set RATE_LIMIT_ENABLED=True --app your-app-name
```

### **3. Verify Deployment**
```bash
# Check app status
heroku ps --app your-app-name

# View logs
heroku logs --tail --app your-app-name

# Test endpoints
curl https://your-app.herokuapp.com/core/health/
```

## 🧪 **Testing the System**

### **Local Docker Testing**
```bash
# Start containers
docker-compose up -d

# Run comprehensive test
./docker_test.sh

# Test video upload
curl -X POST http://localhost:8000/core/api/upload-video/ \
  -F "video=@/path/to/test-video.mp4"

# Open web interface
open http://localhost:8000/core/upload-test/
```

### **Production Testing**
```bash
# Test Heroku deployment
curl https://your-app.herokuapp.com/core/api/upload-video/ \
  -F "video=@/path/to/test-video.mp4"

# Check S3 storage
aws s3 ls s3://your-bucket-name/videos/
```

## 📊 **Monitoring & Debugging**

### **Container Health**
```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs -f web

# Check container health
docker exec $(docker-compose ps -q web) python manage.py check --deploy
```

### **S3 Connectivity**
```bash
# Test S3 from container
docker exec $(docker-compose ps -q web) python -c "
import boto3
s3 = boto3.client('s3')
s3.head_bucket(Bucket='your-bucket-name')
print('S3 connection successful')
"
```

### **API Endpoints**
```bash
# Health check
curl http://localhost:8000/core/health/

# Video listing
curl http://localhost:8000/core/api/videos/

# Metrics
curl http://localhost:8000/core/metrics/
```

## 🔒 **Security Features**

### **File Validation**
- **Size Limit**: 100MB maximum
- **Type Checking**: MIME type and extension validation
- **Content Analysis**: Magic number verification
- **Pattern Detection**: Blocks suspicious filenames

### **Rate Limiting**
- **IP-based Limiting**: 10 uploads per minute per IP
- **Cache Integration**: Uses Django's cache framework
- **Configurable**: Adjustable via environment variables

### **Input Sanitization**
- **Path Traversal Protection**: Prevents directory attacks
- **Filename Validation**: Blocks dangerous patterns
- **MIME Type Verification**: Ensures file type matches content

## 📁 **Storage Strategy**

### **Primary Storage (S3)**
```
When S3 is configured and accessible:
├── Automatic upload to S3 bucket
├── Public read access for video playback
├── Metadata storage (filename, user, timestamp)
└── Organized folder structure (videos/uuid.ext)
```

### **Fallback Storage (Local)**
```
When S3 fails or not configured:
├── Local file storage in /app/media/videos/
├── Django's default storage backend
├── Same validation and security
└── Automatic fallback detection
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **S3 Upload Fails**
```bash
# Check credentials
docker exec $(docker-compose ps -q web) printenv | grep AWS

# Test S3 connectivity
docker exec $(docker-compose ps -q web) python -c "
import boto3
s3 = boto3.client('s3')
s3.head_bucket(Bucket='your-bucket-name')
"
```

#### **Permission Denied**
```bash
# Check media directory permissions
docker exec $(docker-compose ps -q web) ls -la /app/media/

# Fix permissions if needed
docker exec $(docker-compose ps -q web) chmod -R 755 /app/media/
```

#### **Container Won't Start**
```bash
# Check logs
docker-compose logs web

# Rebuild container
docker-compose up -d --build

# Check resource limits
docker stats
```

### **Debug Commands**
```bash
# Enter container shell
docker exec -it $(docker-compose ps -q web) bash

# Check Django settings
docker exec $(docker-compose ps -q web) python manage.py shell -c "
from django.conf import settings
print(f'S3 Bucket: {getattr(settings, \"AWS_STORAGE_BUCKET_NAME\", \"Not set\")}')
print(f'Storage Backend: {settings.DEFAULT_FILE_STORAGE}')
"

# Test file upload manually
docker exec $(docker-compose ps -q web) python manage.py shell
```

## 🎯 **Next Steps**

### **Immediate Actions**
1. **Configure S3**: Set up bucket and credentials
2. **Test Locally**: Run `./docker_test.sh`
3. **Deploy to Heroku**: Use `./deploy-heroku.sh`
4. **Verify S3**: Upload test videos

### **Future Enhancements**
- **Video Processing**: Transcoding, compression, thumbnails
- **CDN Integration**: CloudFront for faster delivery
- **Authentication**: JWT tokens for API access
- **Content Moderation**: AI-powered analysis
- **Backup Strategy**: Cross-region replication

## 💡 **Best Practices**

### **Docker**
- Use multi-stage builds for production
- Set proper resource limits
- Implement health checks
- Use non-root users

### **S3**
- Enable versioning for backup
- Set appropriate CORS policies
- Use IAM roles when possible
- Monitor costs and usage

### **Security**
- Validate all file uploads
- Implement rate limiting
- Use HTTPS everywhere
- Log security events

---

## 🎉 **Summary**

**Your Docker + Heroku + S3 video upload system is now complete!**

The implementation:
- ✅ **Works with Docker containers** (development and production)
- ✅ **Integrates with S3** (automatic fallback to local)
- ✅ **Ready for Heroku deployment** (environment variables configured)
- ✅ **Includes comprehensive testing** (Docker-specific test scripts)
- ✅ **Maintains security** (validation, rate limiting, sanitization)

**Start with local Docker testing, then deploy to Heroku for production use!**
