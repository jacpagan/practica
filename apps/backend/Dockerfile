# Backend image that includes built frontend assets (single-door production)

# 1) Build frontend with Node
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY apps/frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/frontend/ .
RUN npm run build

# 2) Build backend image with Python
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-client \
      build-essential \
      libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# App filesystem layout under /app/apps/{backend,frontend}
WORKDIR /app

# Python deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend source
COPY apps/backend /app/apps/backend

# Copy built frontend into expected path for WhiteNoise/staticfiles
COPY --from=frontend-builder /frontend/dist /app/apps/frontend/dist

# Create media directory
RUN mkdir -p /app/apps/backend/media

EXPOSE 8000

# Use gunicorn in production; migrations + collectstatic on start
CMD ["/bin/sh", "-c", "python /app/apps/backend/manage.py migrate && python /app/apps/backend/manage.py collectstatic --noinput && gunicorn --chdir /app/apps/backend practica.wsgi:application -b 0.0.0.0:8000 --workers 3"]
