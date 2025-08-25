"""
Django settings for Heroku deployment
"""

import os
import dj_database_url
from pathlib import Path
from .settings import *

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'your-secret-key-here')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

# Heroku will set this automatically
ALLOWED_HOSTS = ['*']

# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# HTTPS settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL', 'sqlite:///db.sqlite3'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# AWS S3 Storage Configuration for Heroku
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com' if AWS_STORAGE_BUCKET_NAME else None
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}
AWS_DEFAULT_ACL = 'public-read'
AWS_QUERYSTRING_AUTH = False

# Enhanced S3 Security Settings for Docker/Heroku
AWS_S3_SECURE_URLS = True  # Force HTTPS
AWS_S3_VERIFY = True  # Verify SSL certificates
AWS_S3_SIGNATURE_VERSION = 's3v4'  # Latest signature version

# S3 CORS and bucket policy settings (configure in AWS console)
AWS_S3_ADDRESSING_STYLE = 'virtual'  # Use virtual-hosted style URLs

# Use S3 for media files if configured, otherwise fall back to local
if AWS_STORAGE_BUCKET_NAME:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
    # Keep local media root for fallback
    MEDIA_ROOT = BASE_DIR / 'media'
    
    # S3 storage backend configuration
    AWS_S3_FILE_OVERWRITE = False  # Don't overwrite files with same name
    AWS_S3_MAX_AGE_SECONDS = 31536000  # 1 year cache for videos
    
    # Log S3 configuration
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"S3 storage configured: bucket={AWS_STORAGE_BUCKET_NAME}, region={AWS_S3_REGION_NAME}")
else:
    # Fallback to local storage
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
    logger = logging.getLogger(__name__)
    logger.warning("S3 not configured, using local file storage")

# Simplified logging for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

# Disable debug toolbar in production
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'django_debug_toolbar']

# Cache settings for Heroku Redis - temporarily using local memory cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# Redis configuration for future use (commented out until SSL issues are resolved)
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.redis.RedisCache',
#         'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
#         'OPTIONS': {
#             'CLIENT_CLASS': 'redis.client.DefaultClient',
#             'CONNECTION_POOL_KWARGS': {
#                 'ssl_cert_reqs': None,  # Disable SSL certificate verification for Heroku Redis
#                 'ssl': True,
#             },
#         },
#     }
# }

# File upload settings for Heroku
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB

# Video upload security and validation settings
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB maximum
ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.ogg', '.wmv', '.flv', '.mkv']
ALLOWED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm', 
    'video/quicktime',
    'video/x-msvideo',  # .avi
    'video/ogg',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/x-matroska'
]

# Rate limiting for video uploads
UPLOAD_RATE_LIMIT = '10/minute'  # 10 uploads per minute per IP
RATE_LIMIT_ENABLED = True

# Video processing settings
VIDEO_PROCESSING_ENABLED = True
VIDEO_THUMBNAIL_GENERATION = False  # Disable for now to reduce complexity
VIDEO_COMPRESSION_ENABLED = False   # Disable for now to reduce complexity

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://your-app-name.herokuapp.com",
    "https://yourdomain.com",
]

# Add WhiteNoise middleware for static files
MIDDLEWARE = [
    middleware for middleware in MIDDLEWARE 
    if 'core.middleware.PerformanceMonitoringMiddleware' not in str(middleware)
]

# Ensure WhiteNoise is present for static files
if 'whitenoise.middleware.WhiteNoiseMiddleware' not in MIDDLEWARE:
    # Insert WhiteNoise after SecurityMiddleware
    security_index = None
    for i, middleware in enumerate(MIDDLEWARE):
        if 'SecurityMiddleware' in middleware:
            security_index = i
            break
    
    if security_index is not None:
        MIDDLEWARE.insert(security_index + 1, 'whitenoise.middleware.WhiteNoiseMiddleware')
    else:
        MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

# WhiteNoise configuration for static files
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_USE_FINDERS = True
WHITENOISE_AUTOREFRESH = True

# Debug: Log the video upload settings to confirm they're loaded
import logging
logger = logging.getLogger(__name__)
logger.info(f"Production settings loaded - Video MIME types: {ALLOWED_VIDEO_MIME_TYPES}")
logger.info(f"Production settings loaded - Video extensions: {ALLOWED_VIDEO_EXTENSIONS}")
logger.info(f"Production settings loaded - Max upload size: {MAX_UPLOAD_SIZE}")
