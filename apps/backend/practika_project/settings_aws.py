"""
AWS-specific Django settings for Practika project.
This file contains production settings optimized for AWS ECS deployment.
"""

import os
from .settings import *

# AWS Environment Detection
IS_AWS = os.getenv('AWS_EXECUTION_ENV') is not None
IS_ECS = os.getenv('ECS_CONTAINER_METADATA_URI') is not None

# Security Settings for AWS
DEBUG = False
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')

# AWS S3 Configuration
USE_S3 = True
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN')
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}
AWS_DEFAULT_ACL = 'private'
AWS_QUERYSTRING_AUTH = False

# Static and Media Files
STORAGES = {
    'default': {
        'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        'OPTIONS': {
            'access_key': AWS_ACCESS_KEY_ID,
            'secret_key': AWS_SECRET_ACCESS_KEY,
            'bucket_name': AWS_STORAGE_BUCKET_NAME,
            'region_name': AWS_S3_REGION_NAME,
            'custom_domain': AWS_S3_CUSTOM_DOMAIN,
            'object_parameters': AWS_S3_OBJECT_PARAMETERS,
            'default_acl': AWS_DEFAULT_ACL,
            'querystring_auth': AWS_QUERYSTRING_AUTH,
        }
    },
    'staticfiles': {
        'BACKEND': 'storages.backends.s3boto3.S3StaticStorage',
        'OPTIONS': {
            'access_key': AWS_ACCESS_KEY_ID,
            'secret_key': AWS_SECRET_ACCESS_KEY,
            'bucket_name': AWS_STORAGE_BUCKET_NAME,
            'region_name': AWS_S3_REGION_NAME,
            'custom_domain': AWS_S3_CUSTOM_DOMAIN,
            'object_parameters': AWS_S3_OBJECT_PARAMETERS,
            'default_acl': AWS_DEFAULT_ACL,
            'querystring_auth': AWS_QUERYSTRING_AUTH,
        }
    }
}

STATIC_URL = f'https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/static/'
MEDIA_URL = f'https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/media/'

# Database Configuration for AWS RDS
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

# Parse DATABASE_URL if provided (for compatibility)
if os.getenv('DATABASE_URL'):
    import dj_database_url
    DATABASES['default'] = dj_database_url.parse(os.getenv('DATABASE_URL'))

# AWS-Specific Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# AWS CloudWatch Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# AWS ECS Specific Settings
ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '*.jpagan.com',
    'jpagan.com',
    '*.amazonaws.com',
    '*.elb.amazonaws.com',
    # Allow all internal AWS IPs
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '10.0.2.22',  # Specific internal IP from health checks
    '10.0.2.80',  # Another internal IP from health checks
    '*.internal',
    '*.local',
    # Allow any host for AWS ECS
    '*',
]

# Override with environment variable if provided
if os.getenv('DJANGO_ALLOWED_HOSTS'):
    allowed_hosts_env = os.getenv('DJANGO_ALLOWED_HOSTS')
    if allowed_hosts_env == '*':
        ALLOWED_HOSTS = ['*']
    else:
        ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(',')]

# Authentication Settings
LOGIN_URL = '/exercises/login/'
LOGIN_REDIRECT_URL = '/exercises/'
LOGOUT_REDIRECT_URL = '/exercises/'

# CORS Settings for AWS
CORS_ALLOWED_ORIGINS = [
    f"https://{os.getenv('DOMAIN_NAME', 'localhost')}",
    f"https://{os.getenv('ALB_DNS_NAME', 'localhost')}",
]

CORS_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# AWS S3 File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB
MAX_UPLOAD_SIZE = 104857600  # 100MB

# AWS CloudFront CDN (if configured)
# Uncomment if you need CloudFront CDN for better performance
# if os.getenv('AWS_CLOUDFRONT_DOMAIN'):
#     AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_CLOUDFRONT_DOMAIN')
#     AWS_CLOUDFRONT_DISTRIBUTION_ID = os.getenv('AWS_CLOUDFRONT_DISTRIBUTION_ID')

# AWS SES Email Backend (if configured)
# Uncomment if you need SES for email functionality
# if os.getenv('AWS_SES_REGION_NAME'):
#     EMAIL_BACKEND = 'django_ses.SESBackend'
#     AWS_SES_REGION_NAME = os.getenv('AWS_SES_REGION_NAME')
#     AWS_SES_ACCESS_KEY_ID = os.getenv('AWS_SES_ACCESS_KEY_ID')
#     AWS_SES_SECRET_ACCESS_KEY = os.getenv('AWS_SES_SECRET_ACCESS_KEY')

# AWS ElastiCache Redis (if configured)
# Uncomment if you need Redis for caching/queues
# if os.getenv('REDIS_URL'):
#     CACHES = {
#         'default': {
#             'BACKEND': 'django_redis.cache.RedisCache',
#             'LOCATION': os.getenv('REDIS_URL'),
#             'OPTIONS': {
#                 'CLIENT_CLASS': 'django_redis.client.DefaultClient',
#             }
#         }
#     }
#     SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
#     SESSION_CACHE_ALIAS = 'default'

# AWS Application Load Balancer Health Check
HEALTH_CHECK = {
    'ENABLED': True,
    'PATH': '/core/health/',
    'TIMEOUT': 5,
    'INTERVAL': 30,
}

# AWS Auto Scaling (ECS Service)
ECS_SERVICE_CONFIG = {
    'DESIRED_COUNT': int(os.getenv('ECS_DESIRED_COUNT', '2')),
    'MIN_COUNT': int(os.getenv('ECS_MIN_COUNT', '1')),
    'MAX_COUNT': int(os.getenv('ECS_MAX_COUNT', '4')),
}

# Performance Optimizations for AWS
CONN_MAX_AGE = 60
OPTIMIZE_TABLE_JOINS = True

# AWS CloudWatch Metrics
# Uncomment if you need Prometheus metrics
# if IS_AWS:
#     INSTALLED_APPS += ['django_prometheus']
#     MIDDLEWARE = ['django_prometheus.middleware.PrometheusBeforeMiddleware'] + MIDDLEWARE + ['django_prometheus.middleware.PrometheusAfterMiddleware']

# AWS X-Ray Tracing (if enabled)
# Uncomment if you need X-Ray tracing
# if os.getenv('AWS_XRAY_DAEMON_ADDRESS'):
#     INSTALLED_APPS += ['aws_xray_sdk.ext.django']
#     MIDDLEWARE = ['aws_xray_sdk.ext.django.XRayMiddleware'] + MIDDLEWARE
#     XRAY_RECORDER = {
#         'AWS_XRAY_CONTEXT_MISSING': 'LOG_ERROR',
#         'AWS_XRAY_TRACING_NAME': 'Practika-Django-App',
#     }

