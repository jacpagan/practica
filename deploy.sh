#!/bin/bash
# Practica Reproducible Deployment Script
# Your personal practice tracking system

echo "🚀 Deploying Practica - Your Personal Practice Tracking System"
echo "============================================================="

# Build frontend
echo "⚛️ Building React frontend..."
cd apps/frontend
npm run build

# Collect static files
echo "🐍 Collecting Django static files..."
cd ../backend
python manage.py collectstatic --noinput

# Run migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Deploy to AWS S3
echo "☁️ Deploying to AWS S3..."
aws s3 sync apps/frontend/dist/ s3://practica-frontend-jpagan-com --delete

echo "✅ Deployment complete!"
echo "🌐 Your app is live at: https://practica.jpagan.com"
