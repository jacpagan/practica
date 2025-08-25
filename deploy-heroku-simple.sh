#!/bin/bash

# Simple Heroku deployment script for Practika
# This script deploys the cleaned-up application to Heroku

set -e

echo "🚀 Starting Heroku deployment for Practika..."

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "❌ Error: manage.py not found. Please run this script from the project root."
    exit 1
fi

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Error: Heroku CLI is not installed. Please install it first."
    echo "   Visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if we're logged into Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Error: Not logged into Heroku. Please run 'heroku login' first."
    exit 1
fi

# Get the app name from the current git remote
APP_NAME=$(git remote get-url origin | sed -n 's/.*heroku\.com[:/]\([^.]*\).*/\1/p')

if [ -z "$APP_NAME" ]; then
    echo "❌ Error: Could not determine Heroku app name from git remote."
    echo "   Please ensure you have a Heroku remote configured."
    exit 1
fi

echo "📱 Deploying to Heroku app: $APP_NAME"

# Check if the app exists
if ! heroku apps:info --app "$APP_NAME" &> /dev/null; then
    echo "❌ Error: Heroku app '$APP_NAME' not found or not accessible."
    exit 1
fi

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set DJANGO_ENVIRONMENT=production --app "$APP_NAME"
heroku config:set DJANGO_DEBUG=False --app "$APP_NAME"

# Set a secret key if not already set
if ! heroku config:get DJANGO_SECRET_KEY --app "$APP_NAME" &> /dev/null; then
    echo "🔑 Setting Django secret key..."
    SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
    heroku config:set DJANGO_SECRET_KEY="$SECRET_KEY" --app "$APP_NAME"
fi

# Ensure we have the latest code
echo "📦 Pushing latest code to Heroku..."
git push heroku main

# Run database migrations
echo "🗄️ Running database migrations..."
heroku run python manage.py migrate --app "$APP_NAME"

# Collect static files
echo "📁 Collecting static files..."
heroku run python manage.py collectstatic --noinput --app "$APP_NAME"

# Restart the app
echo "🔄 Restarting the application..."
heroku restart --app "$APP_NAME"

# Wait a moment for the app to start
echo "⏳ Waiting for app to start..."
sleep 10

# Check the app status
echo "🔍 Checking application status..."
if curl -s "https://$APP_NAME.herokuapp.com/" > /dev/null; then
    echo "✅ Application is running successfully!"
    echo "🌐 Your app is available at: https://$APP_NAME.herokuapp.com/"
else
    echo "❌ Application may not be responding. Check the logs:"
    echo "   heroku logs --tail --app $APP_NAME"
fi

echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Test your application at https://$APP_NAME.herokuapp.com/"
echo "   2. Check logs if there are issues: heroku logs --tail --app $APP_NAME"
echo "   3. Monitor your app: heroku open --app $APP_NAME"
