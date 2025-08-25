#!/bin/bash

# Practika v1 Production Deployment Script

echo "🚀 Starting Practika v1 production deployment..."

# Check if environment file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with production settings."
    echo "See env.template for reference."
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
required_vars=("DJANGO_SECRET_KEY" "DJANGO_ENVIRONMENT" "DJANGO_ALLOWED_HOSTS")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done

echo "✅ Environment variables loaded"

# Build Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.v1 -t practika:v1 .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker image built successfully"

# Stop existing container
echo "🛑 Stopping existing container..."
docker stop practika-v1 2>/dev/null || true
docker rm practika-v1 2>/dev/null || true

# Run new container
echo "🚀 Starting new container..."
docker run -d \
    --name practika-v1 \
    --restart unless-stopped \
    -p 8000:8000 \
    --env-file .env \
    practika:v1

if [ $? -ne 0 ]; then
    echo "❌ Container start failed"
    exit 1
fi

echo "✅ Container started successfully"

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 10

# Health check
echo "🏥 Performing health check..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/core/health/)

if [ "$response" = "200" ]; then
    echo "✅ Health check passed"
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "🌐 Application is running at: http://localhost:8000"
    echo "🏥 Health check: http://localhost:8000/core/health/"
    echo "🔐 Admin: http://localhost:8000/admin/"
else
    echo "❌ Health check failed (HTTP $response)"
    echo "📋 Container logs:"
    docker logs practika-v1
    exit 1
fi

