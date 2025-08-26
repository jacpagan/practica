"""
S3 storage backend implementation
"""

import logging
from django.conf import settings
from django.core.files.storage import default_storage
from core.interfaces.storage import StorageBackend

logger = logging.getLogger(__name__)


class S3StorageBackend(StorageBackend):
    """S3 storage backend"""
    
    def upload(self, file_obj, filename: str) -> str:
        """Upload file to S3"""
        try:
            # Use Django's default storage (configured for S3)
            path = default_storage.save(filename, file_obj)
            logger.info(f"File uploaded to S3: {path}")
            return path
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise
    
    def get_url(self, storage_path: str) -> str:
        """Get S3 storage URL for file"""
        try:
            if getattr(settings, 'USE_S3', False):
                # For S3, return the S3 URL
                return default_storage.url(storage_path)
            else:
                # For local storage, return a proper media URL
                media_url = getattr(settings, 'MEDIA_URL', '/media/')
                return f"{media_url}{storage_path}"
        except Exception as e:
            logger.error(f"Failed to get storage URL: {e}")
            return storage_path
    
    def delete(self, storage_path: str) -> bool:
        """Delete S3 file"""
        try:
            default_storage.delete(storage_path)
            logger.info(f"S3 file deleted: {storage_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete S3 file: {e}")
            return False
    
    def exists(self, storage_path: str) -> bool:
        """Check if file exists in S3 storage"""
        try:
            return default_storage.exists(storage_path)
        except Exception as e:
            logger.error(f"Failed to check if file exists in S3: {e}")
            return False
