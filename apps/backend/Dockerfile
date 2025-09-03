# Multi-stage Docker build for Django backend
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base as development
ENV DJANGO_SETTINGS_MODULE=practika.settings
ENV DJANGO_DEBUG=True

# Copy application code
COPY . .

# Create media directory
RUN mkdir -p media

# Expose port
EXPOSE 8000

# Development command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# Production stage
FROM base as production
ENV DJANGO_SETTINGS_MODULE=practika.settings
ENV DJANGO_DEBUG=False

# Copy application code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Create media directory
RUN mkdir -p media

# Expose port
EXPOSE 8000

# Production command
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "practika.wsgi:application"]
