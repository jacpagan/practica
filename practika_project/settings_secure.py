"""
Secure Django settings using AWS Secrets Manager and IAM roles
This configuration eliminates hardcoded credentials and uses AWS best practices
"""

import os
import logging
from .settings import *

# Configure logging for security events
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment Detection
ENVIRONMENT = os.getenv('DJANGO_ENVIRONMENT', 'production')
IS_AWS = os.getenv('AWS_EXECUTION_ENV') is not None
IS_ECS = os.getenv('ECS_CONTAINER_METADATA_URI') is not None

# Security Settings
DEBUG = False  # Always False in secure mode
SECURE_SSL_REDIRECT = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Session Security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Strict'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True

# Import secrets service after Django is configured
try:
    from core.services.aws_secrets_service import secrets_service, get_secret_or_env
    
    # Get Django Secret Key from Secrets Manager
    SECRET_KEY = secrets_service.get_django_secret_key()
    if not SECRET_KEY:
        # Fallback to environment variable for development
        SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
        if not SECRET_KEY:
            raise ValueError("Django secret key not found in secrets manager or environment")
    
    # Database Configuration from Secrets Manager
    db_config = secrets_service.get_database_config()
    if db_config:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': db_config.get('name', 'practika'),
                'USER': db_config.get('user', 'practika_admin'),
                'PASSWORD': db_config.get('password'),
                'HOST': db_config.get('host'),
                'PORT': db_config.get('port', '5432'),
                'OPTIONS': {
                    'sslmode': 'require',
                },
            }
        }
        logger.info("Database configuration loaded from Secrets Manager")
    else:
        # Fallback to environment variables
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.getenv('DB_NAME', 'practika'),
                'USER': os.getenv('DB_USER', 'practika_admin'),
                'PASSWORD': os.getenv('DB_PASSWORD'),
                'HOST': os.getenv('DB_HOST'),
                'PORT': os.getenv('DB_PORT', '5432'),
                'OPTIONS': {
                    'sslmode': 'require',
                },
            }
        }
        logger.warning("Database configuration loaded from environment variables")
    
    # S3 Configuration (using IAM roles, no credentials needed)
    USE_S3 = True
    s3_config = secrets_service.get_s3_config()
    if s3_config:
        AWS_STORAGE_BUCKET_NAME = s3_config.get('bucket_name')
        AWS_S3_REGION_NAME = s3_config.get('region', 'us-east-1')
        AWS_S3_CUSTOM_DOMAIN = s3_config.get('custom_domain')
        logger.info("S3 configuration loaded from Secrets Manager")
    else:
        # Fallback to environment variables
        AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
        AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
        AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN')
        logger.warning("S3 configuration loaded from environment variables")
    
    # Remove explicit AWS credentials - use IAM roles instead
    # AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set
    # This forces boto3 to use IAM instance profile or ECS task role
    
    # S3 Storage Settings
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'storages.backends.s3boto3.S3StaticStorage',
        },
    }
    
    # S3 Configuration
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = 'private'  # More secure default
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_SECURE_URLS = True
    AWS_S3_VERIFY = True
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_S3_ADDRESSING_STYLE = 'virtual'
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_MAX_AGE_SECONDS = 31536000
    
    # Email Configuration (using IAM roles for SES)
    email_config = secrets_service.get_email_config()
    if email_config or IS_AWS:
        EMAIL_BACKEND = 'core.email_backends.AmazonSESEmailBackend'
        if email_config:
            DEFAULT_FROM_EMAIL = email_config.get('from_email', 'noreply@practika.com')
            SES_FROM_NAME = email_config.get('from_name', 'Practika')
            logger.info("Email configuration loaded from Secrets Manager")
        else:
            DEFAULT_FROM_EMAIL = 'noreply@practika.com'
            SES_FROM_NAME = 'Practika'
            logger.info("Using default email configuration with IAM role")
    else:
        EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
        logger.warning("Using console email backend (no AWS credentials)")
    
    # Allowed Hosts from Secrets Manager or environment
    allowed_hosts = get_secret_or_env('allowed_hosts', 'DJANGO_ALLOWED_HOSTS', '')
    if allowed_hosts:
        ALLOWED_HOSTS = [host.strip() for host in allowed_hosts.split(',')]
    else:
        ALLOWED_HOSTS = ['localhost', '127.0.0.1']
    
    # CORS Origins
    cors_origins = get_secret_or_env('cors_origins', 'DJANGO_CORS_ALLOWED_ORIGINS', '')
    if cors_origins:
        CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins.split(',')]
    
    # CSRF Trusted Origins
    csrf_origins = get_secret_or_env('csrf_origins', 'CSRF_TRUSTED_ORIGINS', '')
    if csrf_origins:
        CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_origins.split(',')]
    
    logger.info(f"Secure settings loaded successfully for environment: {ENVIRONMENT}")
    
except ImportError as e:
    logger.error(f"Failed to import secrets service: {e}")
    # Fallback to environment variables if secrets service is not available
    SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("Django secret key not found")
    
    # Basic database configuration
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'practika'),
            'USER': os.getenv('DB_USER', 'practika_admin'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': os.getenv('DB_HOST'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'OPTIONS': {
                'sslmode': 'require',
            },
        }
    }
    
    logger.warning("Using fallback environment variable configuration")

except Exception as e:
    logger.error(f"Error loading secure settings: {e}")
    raise

# Logging Configuration for Security
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'security': {
            'format': '[{asctime}] {levelname} {name} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'security_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/security.log',
            'maxBytes': 1024*1024*10,  # 10MB
            'backupCount': 5,
            'formatter': 'security',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'security',
        },
    },
    'loggers': {
        'core.services.aws_secrets_service': {
            'handlers': ['security_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core.email_backends': {
            'handlers': ['security_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['security_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Cache Configuration (if using Redis)
redis_url = get_secret_or_env('redis_url', 'REDIS_URL', None)
if redis_url:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': redis_url,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'CONNECTION_POOL_KWARGS': {
                    'ssl_cert_reqs': None,
                },
            }
        }
    }

# Rate Limiting Configuration
RATELIMIT_ENABLE = True
RATELIMIT_USE_CACHE = 'default' if redis_url else None

# Additional Security Headers
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'

# Content Security Policy (if django-csp is installed)
try:
    import csp
    CSP_DEFAULT_SRC = ("'self'",)
    CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net")
    CSP_STYLE_SRC = ("'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net")
    CSP_IMG_SRC = ("'self'", "data:", "https:")
    CSP_FONT_SRC = ("'self'", "https://cdn.jsdelivr.net")
    CSP_CONNECT_SRC = ("'self'",)
    CSP_FRAME_ANCESTORS = ("'none'",)
except ImportError:
    pass

logger.info("Secure Django settings configuration completed")
