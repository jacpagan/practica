#!/bin/bash
set -e

echo "Starting Practika application..."

# Wait for database to be ready
echo "Waiting for database connection..."
python manage.py wait_for_db

# Run migrations
echo "Running database migrations..."
python manage.py migrate

# Collect static files (if needed)
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start the application
echo "Starting Gunicorn server..."
exec gunicorn practika_project.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --env DJANGO_SETTINGS_MODULE=practika_project.settings_aws
