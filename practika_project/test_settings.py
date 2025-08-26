"""Test settings for Practika project"""

import os

from .settings import *  # noqa: F401,F403

# Environment flags
ENVIRONMENT = 'testing'
IS_TESTING = True
IS_DEVELOPMENT = False
IS_PRODUCTION = False

# Use SQLite database for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'test_db.sqlite3',
    }
}

# Always use local file storage during tests
USE_S3 = False
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# Separate media directory for tests
MEDIA_ROOT = BASE_DIR / 'test_media'
os.makedirs(MEDIA_ROOT, exist_ok=True)

