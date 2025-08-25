"""
Django settings for Heroku deployment - Fixed version
"""

import os
import dj_database_url
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Import base settings but override problematic ones
from .settings import *

# Override specific settings for Heroku
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'your-secret-key-here')
DEBUG = False

# Environment detection
ENVIRONMENT = 'production'
IS_PRODUCTION = True
IS_DEVELOPMENT = False
IS_TESTING = False

# Ensure ALLOWED_HOSTS includes Heroku domain
ALLOWED_HOSTS = ['*', 'practika-d127ed6da5d2.herokuapp.com', 'practika-container-1e918c8ae02b.herokuapp.com']

# Security settings for production
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', 31536000))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'True').lower() == 'true'
SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'True').lower() == 'true'
SECURE_BROWSER_XSS_FILTER = os.environ.get('SECURE_BROWSER_XSS_FILTER', 'True').lower() == 'true'
SECURE_CONTENT_TYPE_NOSNIFF = os.environ.get('SECURE_CONTENT_TYPE_NOSNIFF', 'True').lower() == 'true'
X_FRAME_OPTIONS = os.environ.get('X_FRAME_OPTIONS', 'DENY')
SECURE_REFERRER_POLICY = os.environ.get('SECURE_REFERRER_POLICY', 'strict-origin-when-cross-origin')

# Session security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_AGE = int(os.environ.get('DJANGO_SESSION_COOKIE_AGE', 3600))

# CSRF security
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False

# Use PostgreSQL from DATABASE_URL if available
if os.environ.get('DATABASE_URL'):
    DATABASES['default'] = dj_database_url.parse(os.environ.get('DATABASE_URL'))

# COMPLETELY OVERRIDE CACHE SETTINGS
if os.environ.get('REDIS_URL'):
    # Use Redis when available on Heroku
    REDIS_URL = os.environ.get('REDIS_URL')
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
    # Use local memory cache for local testing
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
            'TIMEOUT': 300,
        }
    }
    SESSION_ENGINE = 'django.contrib.sessions.backends.db'
    print("Using local memory cache and database sessions for local testing")

# COMPLETELY OVERRIDE REST FRAMEWORK SETTINGS
if os.environ.get('REDIS_URL'):
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
else:
    # Disable throttling when Redis is not available
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

# CORS settings for mobile apps
CORS_ALLOWED_ORIGINS = os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000').split(',')
CORS_ALLOW_CREDENTIALS = os.environ.get('DJANGO_CORS_ALLOW_CREDENTIALS', 'True').lower() == 'true'

# Add Heroku origins if available
if os.environ.get('HEROKU_APP_NAME'):
    CORS_ALLOWED_ORIGINS.append(f"https://{os.environ.get('HEROKU_APP_NAME')}.herokuapp.com")

print("Heroku settings loaded with production configuration - FIXED VERSION")
