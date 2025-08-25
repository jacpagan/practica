#!/bin/bash

# Practika v1 Deployment Script

echo "🚀 Starting Practika v1 deployment..."

# Check if virtual environment exists
if [ ! -d ".practika-venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .practika-venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .practika-venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Run migrations
echo "🗄️ Running database migrations..."
python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if it doesn't exist
echo "👤 Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@practika.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"

# Run tests
echo "🧪 Running tests..."
pytest -x --tb=short

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 To start the development server:"
echo "   source .practika-venv/bin/activate"
echo "   python manage.py runserver"
echo ""
echo "🔐 Admin access:"
echo "   Username: admin"
echo "   Password: admin123"
echo "   URL: http://localhost:8000/admin/"
echo ""
echo "🏥 Health check:"
echo "   URL: http://localhost:8000/core/health/"

