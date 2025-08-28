"""
Clean production settings for Practika platform
Optimized for Heroku deployment and stability
"""

import os
import dj_database_url
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Import base settings
from .settings import *

# Environment detection
ENVIRONMENT = 'production'
IS_PRODUCTION = True
IS_DEVELOPMENT = False
IS_TESTING = False

# Security settings for production
DEBUG = False
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY environment variable is required in production")

# Allowed hosts for production
ALLOWED_HOSTS = ['*', 'practika-d127ed6da5d2.herokuapp.com']

# Security headers and HTTPS
SECURE_SSL_REDIRECT = False  # Disable for Heroku (they handle HTTPS)
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# Session security
SESSION_COOKIE_SECURE = False  # Disable for Heroku (they handle HTTPS)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_AGE = 3600

# CSRF security
CSRF_COOKIE_SECURE = False  # Disable for Heroku (they handle HTTPS)
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False

# CORS settings
CORS_ALLOWED_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://practika-d127ed6da5d2.herokuapp.com'
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = ['*']

# Database configuration - use DATABASE_URL from Heroku
if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.parse(os.environ.get('DATABASE_URL'))
    }
    
    # Add PostgreSQL-specific options
    if DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql':
        DATABASES['default']['OPTIONS'] = {
            'sslmode': 'require',
            'connect_timeout': 20,
        }
        DATABASES['default']['CONN_MAX_AGE'] = 600
else:
    # Fallback to SQLite for local testing
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Static files configuration
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# Ensure admin static files are included
STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
]

# Static files serving in production
STATIC_URL = '/static/'

# WhiteNoise configuration - disabled for now to fix admin panel
# WHITENOISE_USE_FINDERS = True
# WHITENOISE_AUTOREFRESH = False
# WHITENOISE_INDEX_FILE = True

# Ensure staticfiles directory exists
os.makedirs(STATIC_ROOT, exist_ok=True)

# Media files configuration
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Ensure media directory exists
os.makedirs(MEDIA_ROOT, exist_ok=True)

# Storage configuration - S3 for production
USE_S3 = os.getenv('USE_S3', 'True').lower() == 'true'

if USE_S3:
    # S3 storage configuration
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN')
    
    # S3 storage backend (modern Django format)
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
    
    # S3 settings
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = 'public-read'
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_SECURE_URLS = True
    AWS_S3_VERIFY = True
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_S3_ADDRESSING_STYLE = 'virtual'
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_MAX_AGE_SECONDS = 31536000
    
    print("S3 storage configured for production")
else:
    # Local file system storage (modern Django format)
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
    print("Local storage configured for production")

# Email settings - Use Amazon SES if configured, otherwise fallback to console
if os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
    EMAIL_BACKEND = 'core.email_backends.AmazonSESEmailBackend'
    print("Amazon SES email backend configured")
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    print("Console email backend configured (no AWS credentials)")

# Email configuration
EMAIL_HOST = os.getenv('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_USE_SSL = os.getenv('EMAIL_SSL', 'False').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@practika.com')
SITE_URL = os.getenv('SITE_URL', 'https://practika-d127ed6da5d2.herokuapp.com')

# Amazon SES settings
SES_FROM_NAME = os.getenv('SES_FROM_NAME', 'Practika')

# Celery configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'memory://')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'memory://')
CELERY_TASK_ALWAYS_EAGER = os.getenv('CELERY_TASK_ALWAYS_EAGER', 'True').lower() == 'true'

# Simplified middleware - only essential components
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.RequestLoggingMiddleware",
    "core.middleware.SecurityMiddleware",
    "core.middleware.error_handling.EnhancedErrorHandlingMiddleware",
    "core.middleware.rate_limiting.RateLimitingMiddleware",
]

# REST Framework settings - simplified for production
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
    # Disable throttling for now to avoid Redis dependency
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}

# Logging configuration for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '[{levelname}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'error_console': {
            'level': 'ERROR',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console', 'error_console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'error_console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['error_console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'core': {
            'handlers': ['console', 'error_console'],
            'level': 'INFO',
            'propagate': False,
        },
        'exercises': {
            'handlers': ['console', 'error_console'],
            'level': 'INFO',
            'propagate': False,
        },
        'comments': {
            'handlers': ['console', 'error_console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Initialize logging
import logging.config
logging.config.dictConfig(LOGGING)

# File upload settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
FILE_UPLOAD_TEMP_DIR = BASE_DIR / 'temp'

# Create temp directory
os.makedirs(FILE_UPLOAD_TEMP_DIR, exist_ok=True)

# Performance settings
CONN_MAX_AGE = 600

# Health check settings
HEALTH_CHECK = {
    'ENABLED': True,
    'DATABASE_CHECK': True,
    'CACHE_CHECK': False,  # Disable for now
    'STORAGE_CHECK': True,
}

# Final security check
if DEBUG:
    raise ValueError("DEBUG must be False in production!")

# Log production startup
logger = logging.getLogger(__name__)
logger.info("Production settings loaded successfully")
logger.info(f"Environment: {ENVIRONMENT}")
logger.info(f"Debug: {DEBUG}")
logger.info(f"Allowed hosts: {ALLOWED_HOSTS}")
logger.info(f"Database engine: {DATABASES['default']['ENGINE']}")
