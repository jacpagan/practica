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
    # Use Redis cache when available
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'CONNECTION_POOL_KWARGS': {
                    'max_connections': 50,
                    'retry_on_timeout': True,
                },
            },
            'KEY_PREFIX': 'practika_prod',
            'TIMEOUT': 300,
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'
    print(f"Using Redis cache: {REDIS_URL}")
else:
    # For local testing without Redis, use local memory cache
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
            'TIMEOUT': 300,
        }
    }
    # Use database sessions instead of cache sessions
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'
    print("Using local memory cache and database sessions for local testing")

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

# Override REST framework settings to disable throttling when Redis is not available
if not os.environ.get('REDIS_URL'):
    REST_FRAMEWORK = {
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'rest_framework.authentication.SessionAuthentication',
            'rest_framework.authentication.TokenAuthentication',
        ],
        'DEFAULT_PERMISSION_CLASSES': [
            'rest_framework.permissions.IsAuthenticated',
        ],
        'DEFAULT_RENDERER_CLASSES': [
            'rest_framework.renderers.JSONRenderer',
        ],
        'DEFAULT_PARSER_CLASSES': [
            'rest_framework.parsers.JSONParser',
            'rest_framework.parsers.MultiPartParser',
            'rest_framework.parsers.FormParser',
        ],
        'DEFAULT_FILTER_BACKENDS': [
            'django_filters.rest_framework.DjangoFilterBackend',
            'rest_framework.filters.SearchFilter',
            'rest_framework.filters.OrderingFilter',
        ],
        'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
        'PAGE_SIZE': 20,
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {},
    }
    print("REST framework throttling disabled due to Redis unavailability")
else:
    # Use Redis-based throttling when available
    REST_FRAMEWORK = {
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'rest_framework.authentication.SessionAuthentication',
            'rest_framework.authentication.TokenAuthentication',
        ],
        'DEFAULT_PERMISSION_CLASSES': [
            'rest_framework.permissions.IsAuthenticated',
        ],
        'DEFAULT_RENDERER_CLASSES': [
            'rest_framework.renderers.JSONRenderer',
        ],
        'DEFAULT_PARSER_CLASSES': [
            'rest_framework.parsers.JSONParser',
            'rest_framework.parsers.MultiPartParser',
            'rest_framework.parsers.FormParser',
        ],
        'DEFAULT_FILTER_BACKENDS': [
            'django_filters.rest_framework.DjangoFilterBackend',
            'rest_framework.filters.SearchFilter',
            'rest_framework.filters.OrderingFilter',
        ],
        'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
        'PAGE_SIZE': 20,
        'DEFAULT_THROTTLE_CLASSES': [
            'rest_framework.throttling.AnonRateThrottle',
            'rest_framework.throttling.UserRateThrottle'
        ],
        'DEFAULT_THROTTLE_RATES': {
            'anon': '100/hour',
            'user': '1000/hour'
        },
    }
    print("REST framework throttling enabled with Redis")

print("Heroku settings loaded with production configuration")
