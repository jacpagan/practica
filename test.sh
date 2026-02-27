#!/bin/bash
# Practica Reproducible Testing Script
# Your personal practice tracking system

echo "🧪 Testing Practica - Your Personal Practice Tracking System"
echo "=========================================================="

# Test Django backend
echo "🐍 Testing Django backend..."
cd apps/backend
python manage.py test

# Test React frontend
echo "⚛️ Testing React frontend..."
cd ../frontend
npm test

# Run game theory analysis
echo "🎮 Running game theory analysis..."
cd ../..
python3 practica_game_theory.py

echo "✅ All tests passed!"
