#!/bin/bash

# Heroku Deployment Script for Practika Platform
echo "🚀 Starting Heroku deployment..."

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
heroku config:set DJANGO_SETTINGS_MODULE=practika_project.settings_heroku --app "$app_name"

# Generate secret key
echo "🔑 Generating secret key..."
secret_key=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
heroku config:set DJANGO_SECRET_KEY="$secret_key" --app "$app_name"

# Set buildpacks
echo "📦 Setting buildpacks..."
heroku buildpacks:clear --app "$app_name"
heroku buildpacks:add heroku/python --app "$app_name"

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
fi

# Add Heroku remote
echo "🔗 Adding Heroku remote..."
heroku git:remote -a "$app_name"

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git add .
git commit -m "Deploy to Heroku - $(date)"
git push heroku main

# Run migrations
echo "🗄️ Running database migrations..."
heroku run python manage.py migrate --app "$app_name"

# Create superuser
echo "👤 Creating superuser..."
heroku run python manage.py shell --app "$app_name" << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('✅ Superuser created: admin/admin123')
else:
    print('ℹ️ Superuser already exists')
EOF

# Create regular user
echo "👤 Creating regular user..."
heroku run python manage.py shell --app "$app_name" << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='user').exists():
    User.objects.create_user('user', 'user@example.com', 'user123')
    print('✅ Regular user created: user/user123')
else:
    print('ℹ️ Regular user already exists')
EOF

# Open the app
echo "🌐 Opening your app..."
heroku open --app "$app_name"

echo ""
echo "🎉 Deployment complete!"
echo "📱 Your app is live at: https://$app_name.herokuapp.com"
echo "👤 Admin login: admin / admin123"
echo "👤 User login: user / user123"
echo ""
echo "🔧 Useful commands:"
echo "   heroku logs --tail --app $app_name    # View logs"
echo "   heroku run python manage.py shell --app $app_name    # Django shell"
echo "   heroku config --app $app_name    # View config"
echo ""
echo "🚀 Your app is now live and ready for users!"
