"""
Production settings for Practika platform
Optimized for mobile devices, S3 integration, and Heroku deployment
"""

import os
from pathlib import Path
from .settings import *

# Environment detection
ENVIRONMENT = 'production'
IS_PRODUCTION = True
IS_DEVELOPMENT = False
IS_TESTING = False

# Security settings for production
DEBUG = False
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

# Allowed hosts for production
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0').split(',')

# Add Heroku domains if available
if os.environ.get('HEROKU_APP_NAME'):
    ALLOWED_HOSTS.append(f"{os.environ.get('HEROKU_APP_NAME')}.herokuapp.com")

# Explicitly add the known Heroku domain
ALLOWED_HOSTS.append('practika-d127ed6da5d2.herokuapp.com')

# Ensure no duplicates and clean up
ALLOWED_HOSTS = list(set(ALLOWED_HOSTS))

# Security headers and HTTPS
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
CSRF_USE_SESSIONS = True

# CORS settings for mobile apps
CORS_ALLOWED_ORIGINS = os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000').split(',')
CORS_ALLOW_CREDENTIALS = os.environ.get('DJANGO_CORS_ALLOW_CREDENTIALS', 'True').lower() == 'true'
CORS_ALLOW_METHODS = os.environ.get('DJANGO_CORS_ALLOW_METHODS', 'GET,POST,PUT,PATCH,DELETE,OPTIONS').split(',')
CORS_ALLOW_HEADERS = os.environ.get('DJANGO_CORS_ALLOW_HEADERS', '*').split(',')

# Add Heroku origins if available
if os.environ.get('HEROKU_APP_NAME'):
    CORS_ALLOWED_ORIGINS.append(f"https://{os.environ.get('HEROKU_APP_NAME')}.herokuapp.com")

# Database configuration
DATABASES = {
    'default': {
        'ENGINE': os.environ.get('DJANGO_DB_ENGINE', 'django.db.backends.sqlite3'),
        'NAME': os.environ.get('DJANGO_DB_NAME', BASE_DIR / 'db.sqlite3'),
        'USER': os.environ.get('DJANGO_DB_USER', ''),
        'PASSWORD': os.environ.get('DJANGO_DB_PASSWORD', ''),
        'HOST': os.environ.get('DJANGO_DB_HOST', ''),
        'PORT': os.environ.get('DJANGO_DB_PORT', ''),
    }
}

# Add database-specific options
if os.environ.get('DJANGO_DB_ENGINE', '').endswith('sqlite3'):
    DATABASES['default']['OPTIONS'] = {
        'timeout': 20,
        'check_same_thread': False,
    }
elif os.environ.get('DJANGO_DB_ENGINE', '').endswith('postgresql'):
    DATABASES['default']['OPTIONS'] = {
        'sslmode': 'require',
        'connect_timeout': 20,
    }

# Check for DATABASE_URL (Heroku style)
if os.environ.get('DATABASE_URL'):
    import dj_database_url
    DATABASES['default'] = dj_database_url.parse(os.environ.get('DATABASE_URL'))

# Redis configuration for production
REDIS_URL = os.environ.get('DJANGO_REDIS_URL', 'redis://localhost:6379/1')
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
        'TIMEOUT': int(os.environ.get('DJANGO_CACHE_TIMEOUT', 300)),
    }
}

# Session engine
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# Static files configuration
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# WhiteNoise configuration for production
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = False
WHITENOISE_INDEX_FILE = True
WHITENOISE_ROOT = BASE_DIR / 'staticfiles'

# Ensure staticfiles directory exists
os.makedirs(STATIC_ROOT, exist_ok=True)

# Media files configuration with S3
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')

# Only configure S3 if all required credentials are present
if all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_STORAGE_BUCKET_NAME]):
    # S3 Configuration
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN')
    
    # S3 Security and performance settings
    AWS_S3_SECURE_URLS = os.environ.get('AWS_S3_SECURE_URLS', 'True').lower() == 'true'
    AWS_S3_VERIFY = os.environ.get('AWS_S3_VERIFY', 'True').lower() == 'true'
    AWS_S3_SIGNATURE_VERSION = os.environ.get('AWS_S3_SIGNATURE_VERSION', 's3v4')
    AWS_S3_ADDRESSING_STYLE = os.environ.get('AWS_S3_ADDRESSING_STYLE', 'virtual')
    AWS_S3_FILE_OVERWRITE = os.environ.get('AWS_S3_FILE_OVERWRITE', 'False').lower() == 'true'
    AWS_S3_MAX_AGE_SECONDS = int(os.environ.get('AWS_S3_MAX_AGE_SECONDS', 31536000))
    AWS_DEFAULT_ACL = os.environ.get('AWS_DEFAULT_ACL', 'public-read')
    AWS_QUERYSTRING_AUTH = os.environ.get('AWS_QUERYSTRING_AUTH', 'False').lower() == 'true'
    
    # Use S3 for media files
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN or f"{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com"}/'
    
    # S3 Object parameters for video optimization
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': f'max-age={AWS_S3_MAX_AGE_SECONDS}',
        'ContentDisposition': 'inline',
    }
    
    # Log S3 configuration
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"S3 storage configured: bucket={AWS_STORAGE_BUCKET_NAME}, region={AWS_S3_REGION_NAME}")
else:
    # Fallback to local storage - ensure app boots without AWS credentials
    MEDIA_URL = '/media/'
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
    
    # Ensure media directory exists
    os.makedirs(BASE_DIR / 'media' / 'videos', exist_ok=True)
    
    import logging
    logger = logging.getLogger(__name__)
    logger.warning("S3 not configured, using local file storage")
    logger.info("Required S3 environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_STORAGE_BUCKET_NAME")

# Mobile optimization settings
MOBILE_OPTIMIZATION_ENABLED = os.environ.get('MOBILE_OPTIMIZATION_ENABLED', 'True').lower() == 'true'
PWA_ENABLED = os.environ.get('PWA_ENABLED', 'True').lower() == 'true'
VIDEO_COMPRESSION_ENABLED = os.environ.get('VIDEO_COMPRESSION_ENABLED', 'True').lower() == 'true'
MOBILE_CAMERA_QUALITY = os.environ.get('MOBILE_CAMERA_QUALITY', '720p')
MOBILE_MAX_RECORDING_TIME = int(os.environ.get('MOBILE_MAX_RECORDING_TIME', 300))

# Video upload settings
MAX_UPLOAD_SIZE = int(os.environ.get('MAX_UPLOAD_SIZE', 104857600))  # 100MB
UPLOAD_RATE_LIMIT = os.environ.get('UPLOAD_RATE_LIMIT', '10/minute')
RATE_LIMIT_ENABLED = os.environ.get('RATE_LIMIT_ENABLED', 'True').lower() == 'true'

# Performance settings
CONN_MAX_AGE = int(os.environ.get('DJANGO_CONN_MAX_AGE', 600))
OPTIONS_MAX_CONNS = int(os.environ.get('DJANGO_OPTIONS_MAX_CONNS', 20))

# Logging configuration for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {process:d} {thread:d} {request_id} {message}',
            'style': '{',
        },
        'simple': {
            'format': '[{levelname}] {request_id} {message}',
            'style': '{',
        },
        'gunicorn': {
            'format': '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s %(L)s',
        },
    },
    'filters': {
        'request_id': {
            '()': 'core.middleware.RequestIDFilter',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'filters': ['request_id'],
        },
        'error_console': {
            'level': 'ERROR',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
            'filters': ['request_id'],
        },
        'gunicorn_access': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'gunicorn',
        },
        'gunicorn_error': {
            'level': 'ERROR',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
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
        'django.security': {
            'handlers': ['error_console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'gunicorn.access': {
            'handlers': ['gunicorn_access'],
            'level': 'INFO',
            'propagate': False,
        },
        'gunicorn.error': {
            'handlers': ['gunicorn_error'],
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
    'root': {
        'handlers': ['console', 'error_console'],
        'level': 'INFO',
    },
}

# Create logs directory if it doesn't exist
os.makedirs(BASE_DIR / 'logs', exist_ok=True)

# Initialize logging
import logging.config
logging.config.dictConfig(LOGGING)

# Performance monitoring
PERFORMANCE_MONITORING = {
    'ENABLED': os.environ.get('DJANGO_PERFORMANCE_MONITORING', 'True').lower() == 'true',
    'SLOW_QUERY_THRESHOLD': float(os.environ.get('DJANGO_SLOW_QUERY_THRESHOLD', 1.0)),
    'LOG_SLOW_QUERIES': True,
    'LOG_MEMORY_USAGE': True,
}

# Health check settings
HEALTH_CHECK = {
    'ENABLED': os.environ.get('HEALTH_CHECK_ENABLED', 'True').lower() == 'true',
    'DATABASE_CHECK': True,
    'CACHE_CHECK': True,
    'STORAGE_CHECK': True,
}

# API Documentation
API_DOCUMENTATION = {
    'ENABLED': True,
    'TITLE': 'Practika API',
    'DESCRIPTION': 'Learning Management System API - Production',
    'VERSION': '1.0.0',
}

# Rate limiting
RATE_LIMITING = {
    'ENABLED': RATE_LIMIT_ENABLED,
    'DEFAULT_RATE': '100/hour',
    'BURST_RATE': '200/hour',
    'LOGIN_RATE': os.environ.get('LOGIN_RATE_LIMIT', '5/minute'),
    'UPLOAD_RATE': UPLOAD_RATE_LIMIT,
}

# Security monitoring
SECURITY_LOGGING_ENABLED = True
FAILED_LOGIN_ATTEMPTS_LIMIT = int(os.environ.get('FAILED_LOGIN_ATTEMPTS_LIMIT', 5))
ACCOUNT_LOCKOUT_DURATION = int(os.environ.get('ACCOUNT_LOCKOUT_DURATION', 300))

# Monitoring and metrics
METRICS = {
    'ENABLED': os.environ.get('METRICS_ENABLED', 'True').lower() == 'true',
    'PROMETHEUS_ENABLED': os.environ.get('DJANGO_PROMETHEUS_ENABLED', 'False').lower() == 'true',
    'HEALTH_CHECK_ENDPOINT': '/health/',
    'METRICS_ENDPOINT': '/metrics/',
}

# Middleware for mobile optimization and device compatibility
if MOBILE_OPTIMIZATION_ENABLED:
    MIDDLEWARE += [
        'core.middleware.MobileOptimizationMiddleware',
        'core.middleware.DeviceCompatibilityMiddleware',
    ]

# PWA settings
if PWA_ENABLED:
    PWA_APP_NAME = 'Practika'
    PWA_APP_DESCRIPTION = 'Video Learning Platform'
    PWA_APP_THEME_COLOR = '#2c3e50'
    PWA_APP_BACKGROUND_COLOR = '#ffffff'
    PWA_APP_DISPLAY = 'standalone'
    PWA_APP_SCOPE = '/'
    PWA_APP_START_URL = '/'
    PWA_APP_ICONS = [
        {
            'src': '/static/icons/icon-192x192.png',
            'sizes': '192x192',
            'type': 'image/png'
        },
        {
            'src': '/static/icons/icon-512x512.png',
            'sizes': '512x512',
            'type': 'image/png'
        }
    ]

# Video processing settings
if VIDEO_COMPRESSION_ENABLED:
    VIDEO_PROCESSING = {
        'ENABLED': True,
        'QUALITY': MOBILE_CAMERA_QUALITY,
        'MAX_DURATION': MOBILE_MAX_RECORDING_TIME,
        'FORMATS': ['mp4', 'webm', 'mov'],
        'COMPRESSION_LEVEL': 'medium',
        'THUMBNAIL_GENERATION': True,
        'WATERMARK': False,
    }

# Cache settings for mobile optimization
CACHE_MIDDLEWARE_SECONDS = 300
CACHE_MIDDLEWARE_KEY_PREFIX = 'practika_mobile'
CACHE_MIDDLEWARE_ALIAS = 'default'

# Session settings for mobile
SESSION_SAVE_EVERY_REQUEST = False
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# File upload settings for mobile
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB in memory
FILE_UPLOAD_TEMP_DIR = BASE_DIR / 'temp'
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB

# Create temp directory
os.makedirs(FILE_UPLOAD_TEMP_DIR, exist_ok=True)

# Email configuration (if needed for production)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@practika.com')

# Celery configuration for background tasks (if needed)
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Production-specific apps
if os.environ.get('DJANGO_PROMETHEUS_ENABLED', 'False').lower() == 'true':
    INSTALLED_APPS.append('django_prometheus')

# Final security check
if DEBUG:
    raise ValueError("DEBUG must be False in production!")

# Log production startup
logger = logging.getLogger(__name__)
logger.info("Production settings loaded successfully")
logger.info(f"Environment: {ENVIRONMENT}")
logger.info(f"Debug: {DEBUG}")
logger.info(f"Allowed hosts: {ALLOWED_HOSTS}")
logger.info(f"S3 configured: {bool(os.environ.get('AWS_STORAGE_BUCKET_NAME'))}")
logger.info(f"Mobile optimization: {MOBILE_OPTIMIZATION_ENABLED}")
logger.info(f"PWA enabled: {PWA_ENABLED}")
