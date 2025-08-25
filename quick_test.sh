#!/bin/bash

echo "🚀 Quick Test for Practika Video Upload System"
echo "=============================================="

# Check if Django is running
echo "🔍 Checking if Django server is running..."
if curl -s http://localhost:8000/core/health/ > /dev/null; then
    echo "✅ Django server is running"
else
    echo "❌ Django server is not running"
    echo "   Start it with: python manage.py runserver"
    exit 1
fi

# Test health endpoint
echo "🔍 Testing health endpoint..."
health_response=$(curl -s http://localhost:8000/core/health/)
if echo "$health_response" | grep -q "healthy"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    echo "   Response: $health_response"
fi

# Test video listing endpoint
echo "🔍 Testing video listing endpoint..."
videos_response=$(curl -s http://localhost:8000/core/api/videos/)
if echo "$videos_response" | grep -q "videos"; then
    echo "✅ Video listing endpoint working"
    video_count=$(echo "$videos_response" | grep -o '"total_count":[0-9]*' | grep -o '[0-9]*')
    echo "   Current videos: $video_count"
else
    echo "❌ Video listing endpoint failed"
    echo "   Response: $videos_response"
fi

# Check S3 configuration
echo "🔍 Checking S3 configuration..."
if [ -n "$AWS_STORAGE_BUCKET_NAME" ]; then
    echo "✅ S3 bucket configured: $AWS_STORAGE_BUCKET_NAME"
    echo "   Region: ${AWS_S3_REGION_NAME:-us-east-1}"
else
    echo "⚠️  S3 bucket not configured - will use local storage"
fi

echo ""
echo "🎯 Test completed!"
echo ""
echo "To test video uploads:"
echo "1. Open browser: http://localhost:8000/core/upload-test/"
echo "2. Or use API directly:"
echo "   curl -X POST http://localhost:8000/core/api/upload-video/ \\"
echo "     -F \"video=@/path/to/your/video.mp4\""
echo ""
echo "To run comprehensive tests:"
echo "   python test_video_upload.py"
