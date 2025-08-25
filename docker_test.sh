#!/bin/bash

echo "🐳 Docker Video Upload System Test"
echo "=================================="

# Check if Docker containers are running
echo "🔍 Checking Docker containers..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Docker containers are running"
else
    echo "❌ Docker containers are not running"
    echo "   Start them with: docker-compose up -d"
    exit 1
fi

# Get the container name
CONTAINER_NAME=$(docker-compose ps -q web)
if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ Web container not found"
    exit 1
fi

echo "🔍 Testing container health..."
# Test health check
if docker exec $CONTAINER_NAME python manage.py check --deploy; then
    echo "✅ Django health check passed"
else
    echo "❌ Django health check failed"
fi

# Test if the container can reach S3
echo "🔍 Testing S3 connectivity..."
if docker exec $CONTAINER_NAME python -c "
import os
import boto3
from botocore.exceptions import ClientError

bucket_name = os.environ.get('AWS_STORAGE_BUCKET_NAME')
if bucket_name:
    try:
        s3 = boto3.client('s3')
        s3.head_bucket(Bucket=bucket_name)
        print('S3 connection successful')
    except ClientError as e:
        print(f'S3 connection failed: {e}')
else:
    print('S3 not configured')
"; then
    echo "✅ S3 connectivity test completed"
else
    echo "❌ S3 connectivity test failed"
fi

# Test API endpoints
echo "🔍 Testing API endpoints..."
BASE_URL="http://localhost:8000"

# Test health endpoint
if curl -s "$BASE_URL/core/health/" | grep -q "healthy"; then
    echo "✅ Health endpoint working"
else
    echo "❌ Health endpoint failed"
fi

# Test video listing endpoint
if curl -s "$BASE_URL/core/api/videos/" | grep -q "videos"; then
    echo "✅ Video listing endpoint working"
else
    echo "❌ Video listing endpoint failed"
fi

# Check environment variables
echo "🔍 Checking environment configuration..."
echo "   Django Environment: $(docker exec $CONTAINER_NAME printenv DJANGO_ENVIRONMENT)"
echo "   Debug Mode: $(docker exec $CONTAINER_NAME printenv DJANGO_DEBUG)"
echo "   S3 Bucket: $(docker exec $CONTAINER_NAME printenv AWS_STORAGE_BUCKET_NAME)"
echo "   Max Upload Size: $(docker exec $CONTAINER_NAME printenv MAX_UPLOAD_SIZE)"
echo "   Upload Rate Limit: $(docker exec $CONTAINER_NAME printenv UPLOAD_RATE_LIMIT)"

# Check media directory permissions
echo "🔍 Checking media directory permissions..."
if docker exec $CONTAINER_NAME ls -la /app/media/ | grep -q "drwxr-xr-x"; then
    echo "✅ Media directory permissions correct"
else
    echo "❌ Media directory permissions incorrect"
fi

echo ""
echo "🎯 Docker test completed!"
echo ""
echo "To test video uploads:"
echo "1. Open browser: http://localhost:8000/core/upload-test/"
echo "2. Or use API directly:"
echo "   curl -X POST http://localhost:8000/core/api/upload-video/ \\"
echo "     -F \"video=@/path/to/your/video.mp4\""
echo ""
echo "To view container logs:"
echo "   docker-compose logs -f web"
echo ""
echo "To restart containers:"
echo "   docker-compose restart"
echo ""
echo "To rebuild and restart:"
echo "   docker-compose up -d --build"
