"""
Django settings for Heroku deployment
"""

import os
import dj_database_url
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Import production settings as base
from .production import *

# Override specific settings for Heroku
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'your-secret-key-here')
DEBUG = False

# Ensure ALLOWED_HOSTS includes Heroku domain
ALLOWED_HOSTS = ['*', 'practika-d127ed6da5d2.herokuapp.com']

# Use PostgreSQL from DATABASE_URL if available
if os.environ.get('DATABASE_URL'):
    DATABASES['default'] = dj_database_url.parse(os.environ.get('DATABASE_URL'))

# Ensure Redis is configured from environment
if os.environ.get('REDIS_URL'):
    REDIS_URL = os.environ.get('REDIS_URL')
    CACHES['default']['LOCATION'] = REDIS_URL

# Ensure all apps are included
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'django_filters',
    'corsheaders',
    'core',
    'exercises',
    'comments',
]

# Ensure all middleware is included
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.RequestLoggingMiddleware",
    "core.middleware.PerformanceMonitoringMiddleware",
    "core.middleware.SecurityMiddleware",
    "core.middleware.MobileOptimizationMiddleware",
]

# Ensure templates include the correct directories
TEMPLATES[0]['DIRS'] = [BASE_DIR / "templates"]

# Ensure static files are properly configured
STATICFILES_DIRS = [BASE_DIR / "static"]

print("Heroku settings loaded with production configuration")
