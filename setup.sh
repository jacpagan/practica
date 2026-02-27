#!/bin/bash
# Practica Reproducible Setup Script
# Your personal practice tracking system

echo "🎯 Setting up Practica - Your Personal Practice Tracking System"
echo "=============================================================="

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip install -r requirements.txt

# Setup Django
echo "🐍 Setting up Django..."
cd apps/backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

# Setup React
echo "⚛️ Setting up React..."
cd ../frontend
npm install

echo "✅ Setup complete!"
echo "🚀 To start development:"
echo "   Backend: cd apps/backend && python manage.py runserver"
echo "   Frontend: cd apps/frontend && npm run dev"
