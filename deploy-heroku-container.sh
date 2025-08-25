#!/bin/bash

# Practika Platform - Heroku Container Deployment Script
# Single App Strategy: One app, one URL, no confusion

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Practika Platform - Heroku Container Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}Strategy: Single consolidated app (no duplicate apps)${NC}"
echo -e "${YELLOW}Goal: One app, one URL, cleaner management${NC}"
echo ""

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo -e "${RED}❌ Heroku CLI not found. Please install it first:${NC}"
    echo "   brew install heroku/brew/heroku"
    exit 1
fi

# Check if user is logged in
if ! heroku auth:whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Heroku. Please run: heroku login${NC}"
    exit 1
fi

# Get app name from user
echo -e "${BLUE}📝 Enter your Heroku app name (or press Enter to create a new one):${NC}"
read app_name

if [ -z "$app_name" ]; then
    echo -e "${GREEN}🆕 Creating new Heroku app...${NC}"
    app_name=$(heroku create --json | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])")
    echo -e "${GREEN}✅ Created app: $app_name${NC}"
else
    echo -e "${BLUE}🔗 Using existing app: $app_name${NC}"
fi

# Check if app exists
if ! heroku apps:info --app "$app_name" &> /dev/null; then
    echo -e "${RED}❌ App '$app_name' not found. Creating new app...${NC}"
    app_name=$(heroku create "$app_name" --json | python3 -c "import sys, json; print(json.load(sys.stdin)['name'])")
fi

echo -e "${BLUE}🏗️ Setting up Heroku app: $app_name${NC}"

# Set stack to container
echo -e "${BLUE}🐳 Setting stack to container...${NC}"
heroku stack:set container --app "$app_name"

# Add PostgreSQL addon
echo -e "${BLUE}🗄️ Adding PostgreSQL database...${NC}"
heroku addons:create heroku-postgresql:mini --app "$app_name"

# Add Redis addon
echo -e "${BLUE}🔴 Adding Redis cache...${NC}"
heroku addons:create heroku-redis:mini --app "$app_name"

# Set environment variables
echo -e "${BLUE}🔧 Setting environment variables...${NC}"
heroku config:set DJANGO_ENVIRONMENT=production --app "$app_name"
heroku config:set DJANGO_DEBUG=False --app "$app_name"
heroku config:set DJANGO_SETTINGS_MODULE=practika_project.production --app "$app_name"

# Generate secret key
echo -e "${BLUE}🔑 Generating secret key...${NC}"
secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
heroku config:set DJANGO_SECRET_KEY="$secret_key" --app "$app_name"

# Set mobile optimization settings
echo -e "${BLUE}📱 Setting mobile optimization settings...${NC}"
heroku config:set MOBILE_OPTIMIZATION_ENABLED=True --app "$app_name"
heroku config:set PWA_ENABLED=True --app "$app_name"
heroku config:set VIDEO_COMPRESSION_ENABLED=True --app "$app_name"
heroku config:set MOBILE_CAMERA_QUALITY=720p --app "$app_name"
heroku config:set MOBILE_MAX_RECORDING_TIME=300 --app "$app_name"

# Set security settings
echo -e "${BLUE}🔒 Setting security settings...${NC}"
heroku config:set SECURE_SSL_REDIRECT=True --app "$app_name"
heroku config:set SECURE_HSTS_SECONDS=31536000 --app "$app_name"
heroku config:set SECURE_HSTS_INCLUDE_SUBDOMAINS=True --app "$app_name"
heroku config:set SECURE_HSTS_PRELOAD=True --app "$app_name"

# Set performance settings
echo -e "${BLUE}⚡ Setting performance settings...${NC}"
heroku config:set GUNICORN_WORKERS=1 --app "$app_name"
heroku config:set GUNICORN_TIMEOUT=30 --app "$app_name"
heroku config:set GUNICORN_LOG_LEVEL=info --app "$app_name"

# S3 Configuration (optional)
echo -e "${BLUE}☁️ S3 Configuration (optional):${NC}"
echo -e "${YELLOW}   Leave blank to skip S3 setup and use local storage${NC}"
echo -e "${BLUE}   AWS Access Key ID:${NC}"
read aws_access_key_id

if [ -n "$aws_access_key_id" ]; then
    echo -e "${BLUE}   AWS Secret Access Key:${NC}"
    read -s aws_secret_access_key
    echo -e "${BLUE}   AWS S3 Bucket Name:${NC}"
    read aws_bucket_name
    echo -e "${BLUE}   AWS S3 Region (default: us-east-1):${NC}"
    read aws_region
    aws_region=${aws_region:-us-east-1}
    
    echo -e "${BLUE}🔧 Setting S3 configuration...${NC}"
    heroku config:set AWS_ACCESS_KEY_ID="$aws_access_key_id" --app "$app_name"
    heroku config:set AWS_SECRET_ACCESS_KEY="$aws_secret_access_key" --app "$app_name"
    heroku config:set AWS_STORAGE_BUCKET_NAME="$aws_bucket_name" --app "$app_name"
    heroku config:set AWS_S3_REGION_NAME="$aws_region" --app "$app_name"
    echo -e "${GREEN}✅ S3 configuration set successfully${NC}"
else
    echo -e "${YELLOW}ℹ️ Skipping S3 configuration - will use local storage${NC}"
fi

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo -e "${BLUE}📝 Initializing git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit for Heroku container deployment"
fi

# Add Heroku remote
echo -e "${BLUE}🔗 Adding Heroku remote...${NC}"
heroku git:remote -a "$app_name"

# Deploy to Heroku
echo -e "${BLUE}🚀 Deploying to Heroku with container stack...${NC}"
git add .
git commit -m "Deploy to Heroku with container stack - $(date)"
git push heroku main

# Wait for build to complete
echo -e "${BLUE}⏳ Waiting for build to complete...${NC}"
sleep 30

# Check build status
echo -e "${BLUE}🔍 Checking build status...${NC}"
heroku builds --app "$app_name"

# Check app status
echo -e "${BLUE}📊 Checking app status...${NC}"
heroku ps --app "$app_name"

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
echo -e "${YELLOW}   Testing health endpoint...${NC}"
if heroku run curl -f http://localhost:8000/health/ --app "$app_name"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ Health check failed - app may still be starting${NC}"
fi

# Display app information
echo ""
echo -e "${GREEN}🎉 Container deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📱 Your Practika app is now live at:${NC}"
echo "   https://$app_name.herokuapp.com"
echo ""
echo -e "${BLUE}🔧 Container stack configuration:${NC}"
echo "   - Build: Dockerfile.prod"
echo "   - Release: Migrations + collectstatic"
echo "   - Run: Gunicorn with production settings"
echo ""
echo -e "${BLUE}📊 App status:${NC}"
heroku ps --app "$app_name"
echo ""
echo -e "${BLUE}🔧 Environment variables:${NC}"
heroku config --app "$app_name" | grep -E "(DJANGO_|AWS_|MOBILE_|GUNICORN_)"
echo ""
echo -e "${BLUE}📱 Mobile Features Enabled:${NC}"
echo "   ✅ PWA (Progressive Web App)"
echo "   ✅ Mobile-optimized video recording"
echo "   ✅ Responsive design"
echo "   ✅ Touch-friendly interface"
echo "   ✅ Camera integration"
echo "   ✅ File upload optimization"
echo ""
if [ -n "$aws_access_key_id" ]; then
    echo -e "${BLUE}☁️ S3 Storage:${NC}"
    echo "   ✅ Configured and ready"
    echo "   📝 Next steps:"
    echo "      1. Configure S3 bucket CORS policy"
    echo "      2. Set bucket policy for public read access"
    echo "      3. Test video uploads"
else
    echo -e "${YELLOW}💾 Local Storage:${NC}"
    echo "   ✅ Using local file storage"
    echo "   📝 Note: Videos will be stored locally on Heroku"
    echo "      Consider upgrading to S3 for production use"
fi
echo ""
echo -e "${GREEN}🚀 Next steps:${NC}"
echo "   1. Test the app on your mobile device"
echo "   2. Try recording a video with your phone camera"
echo "   3. Test file uploads from mobile"
echo "   4. Verify PWA installation on mobile"
echo "   5. Monitor app performance with: heroku logs --tail --app $app_name"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - Mobile guide: https://$app_name.herokuapp.com/static/manifest.json"
echo "   - API docs: https://$app_name.herokuapp.com/api/"
echo "   - Health check: https://$app_name.herokuapp.com/health/"
echo ""
echo -e "${GREEN}🎯 Your Practika platform is now production-ready with container deployment!${NC}"
