"""
Test-specific Django settings for Practika
"""
import os
from pathlib import Path
from .settings import *

# Use in-memory SQLite for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable password hashing for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Use console email backend for tests
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Disable logging during tests
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
    },
    'root': {
        'handlers': ['null'],
    },
}

# Disable cache during tests
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# Use temporary media directory for tests
MEDIA_ROOT = Path(BASE_DIR) / 'test_media'

# Ensure test media directory exists
MEDIA_ROOT.mkdir(exist_ok=True)

# Disable security middleware for tests (if needed)
MIDDLEWARE = [m for m in MIDDLEWARE if 'SecurityMiddleware' not in m]

# Test-specific video MIME types
ACCEPTED_VIDEO_MIME_TYPES = [
    "video/mp4",
    "video/webm", 
    "video/quicktime",
    "video/x-msvideo",  # Add AVI support for tests
]

# Disable debug toolbar during tests
INSTALLED_APPS = [app for app in INSTALLED_APPS if 'debug_toolbar' not in app]

# Use faster password validation for tests
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 3,  # Very short for tests
        }
    },
]

# Disable CSRF for tests
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False

# Use simple session backend for tests
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# Disable file upload handlers that might interfere with tests
FILE_UPLOAD_HANDLERS = [
    'django.core.files.uploadhandler.MemoryFileUploadHandler',
    'django.core.files.uploadhandler.TemporaryFileUploadHandler',
]

# Test-specific security settings
SECURE_BROWSER_XSS_FILTER = False
SECURE_CONTENT_TYPE_NOSNIFF = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
