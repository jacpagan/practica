#!/bin/bash

# Heroku Container Deployment Script for Practika
# This script deploys using the container stack with heroku.yml

set -e

echo "🚀 Starting Heroku Container Deployment for Practika..."

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   brew install heroku/brew/heroku"
    exit 1
fi

# Check if user is logged in
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged in to Heroku. Please run: heroku login"
    exit 1
fi

# Get app name from user
echo "📝 Enter your Heroku app name (or press Enter to create a new one):"
read app_name

if [ -z "$app_name" ]; then
    echo "🆕 Creating new Heroku app..."
    app_name=$(heroku create --json | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])")
    echo "✅ Created app: $app_name"
else
    echo "🔗 Using existing app: $app_name"
fi

# Check if app exists
if ! heroku apps:info --app "$app_name" &> /dev/null; then
    echo "❌ App '$app_name' not found. Creating new app..."
    app_name=$(heroku create "$app_name" --json | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])")
fi

echo "🏗️ Setting up Heroku app: $app_name"

# Set stack to container
echo "🐳 Setting stack to container..."
heroku stack:set container --app "$app_name"

# Add PostgreSQL addon
echo "🗄️ Adding PostgreSQL database..."
heroku addons:create heroku-postgresql:mini --app "$app_name"

# Add Redis addon
echo "🔴 Adding Redis cache..."
heroku addons:create heroku-redis:mini --app "$app_name"

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set DJANGO_ENVIRONMENT=production --app "$app_name"
heroku config:set DJANGO_DEBUG=False --app "$app_name"
heroku config:set DJANGO_SETTINGS_MODULE=practika_project.production --app "$app_name"

# Generate secret key
echo "🔑 Generating secret key..."
secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
heroku config:set DJANGO_SECRET_KEY="$secret_key" --app "$app_name"

# Set mobile optimization settings
echo "📱 Setting mobile optimization settings..."
heroku config:set MOBILE_OPTIMIZATION_ENABLED=True --app "$app_name"
heroku config:set PWA_ENABLED=True --app "$app_name"
heroku config:set VIDEO_COMPRESSION_ENABLED=True --app "$app_name"
heroku config:set MOBILE_CAMERA_QUALITY=720p --app "$app_name"
heroku config:set MOBILE_MAX_RECORDING_TIME=300 --app "$app_name"

# Set security settings
echo "🔒 Setting security settings..."
heroku config:set SECURE_SSL_REDIRECT=True --app "$app_name"
heroku config:set SECURE_HSTS_SECONDS=31536000 --app "$app_name"
heroku config:set SECURE_HSTS_INCLUDE_SUBDOMAINS=True --app "$app_name"
heroku config:set SECURE_HSTS_PRELOAD=True --app "$app_name"

# Set performance settings
echo "⚡ Setting performance settings..."
heroku config:set GUNICORN_WORKERS=1 --app "$app_name"
heroku config:set GUNICORN_TIMEOUT=30 --app "$app_name"
heroku config:set GUNICORN_LOG_LEVEL=info --app "$app_name"

# S3 Configuration (optional)
echo "☁️ S3 Configuration (optional):"
echo "   Leave blank to skip S3 setup and use local storage"
echo "   AWS Access Key ID:"
read aws_access_key_id

if [ -n "$aws_access_key_id" ]; then
    echo "   AWS Secret Access Key:"
    read -s aws_secret_access_key
    echo "   AWS S3 Bucket Name:"
    read aws_bucket_name
    echo "   AWS S3 Region (default: us-east-1):"
    read aws_region
    aws_region=${aws_region:-us-east-1}
    
    echo "🔧 Setting S3 configuration..."
    heroku config:set AWS_ACCESS_KEY_ID="$aws_access_key_id" --app "$app_name"
    heroku config:set AWS_SECRET_ACCESS_KEY="$aws_secret_access_key" --app "$app_name"
    heroku config:set AWS_STORAGE_BUCKET_NAME="$aws_bucket_name" --app "$app_name"
    heroku config:set AWS_S3_REGION_NAME="$aws_region" --app "$app_name"
    echo "✅ S3 configuration set successfully"
else
    echo "ℹ️ Skipping S3 configuration - will use local storage"
fi

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for Heroku container deployment"
fi

# Add Heroku remote
echo "🔗 Adding Heroku remote..."
heroku git:remote -a "$app_name"

# Deploy to Heroku
echo "🚀 Deploying to Heroku with container stack..."
git add .
git commit -m "Deploy to Heroku with container stack - $(date)"
git push heroku main

# Wait for build to complete
echo "⏳ Waiting for build to complete..."
sleep 30

# Check build status
echo "🔍 Checking build status..."
heroku builds --app "$app_name"

# Check app status
echo "📊 Checking app status..."
heroku ps --app "$app_name"

# Test the deployment
echo "🧪 Testing deployment..."
echo "   Testing health endpoint..."
if heroku run curl -f http://localhost:8000/health/ --app "$app_name"; then
    echo "✅ Health check passed"
else
    echo "⚠️ Health check failed - app may still be starting"
fi

# Display app information
echo ""
echo "🎉 Container deployment completed successfully!"
echo ""
echo "📱 Your Practika app is now live at:"
echo "   https://$app_name.herokuapp.com"
echo ""
echo "🔧 Container stack configuration:"
echo "   - Build: Dockerfile.prod"
echo "   - Release: Migrations + collectstatic"
echo "   - Run: Gunicorn with production settings"
echo ""
echo "📊 App status:"
heroku ps --app "$app_name"
echo ""
echo "🔧 Environment variables:"
heroku config --app "$app_name" | grep -E "(DJANGO_|AWS_|MOBILE_|GUNICORN_)"
echo ""
echo "📱 Mobile Features Enabled:"
echo "   ✅ PWA (Progressive Web App)"
echo "   ✅ Mobile-optimized video recording"
echo "   ✅ Responsive design"
echo "   ✅ Touch-friendly interface"
echo "   ✅ Camera integration"
echo "   ✅ File upload optimization"
echo ""
if [ -n "$aws_access_key_id" ]; then
    echo "☁️ S3 Storage:"
    echo "   ✅ Configured and ready"
    echo "   📝 Next steps:"
    echo "      1. Configure S3 bucket CORS policy"
    echo "      2. Set bucket policy for public read access"
    echo "      3. Test video uploads"
else
    echo "💾 Local Storage:"
    echo "   ✅ Using local file storage"
    echo "   📝 Note: Videos will be stored locally on Heroku"
    echo "      Consider upgrading to S3 for production use"
fi
echo ""
echo "🚀 Next steps:"
echo "   1. Test the app on your mobile device"
echo "   2. Try recording a video with your phone camera"
echo "   3. Test file uploads from mobile"
echo "   4. Verify PWA installation on mobile"
echo "   5. Monitor app performance with: heroku logs --tail --app $app_name"
echo ""
echo "📚 Documentation:"
echo "   - Mobile guide: https://$app_name.herokuapp.com/static/manifest.json"
echo "   - API docs: https://$app_name.herokuapp.com/api/"
echo "   - Health check: https://$app_name.herokuapp.com/health/"
echo ""
echo "🎯 Your Practika platform is now production-ready with container deployment!"
