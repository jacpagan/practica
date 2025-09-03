"""
Local storage backend implementation
"""

import logging
from django.core.files.storage import default_storage
from core.interfaces.storage import StorageBackend

logger = logging.getLogger(__name__)


class LocalStorageBackend(StorageBackend):
    """Local file system storage backend"""
    
    def upload(self, file_obj, filename: str) -> str:
        """Upload file to local storage"""
        try:
            # Use Django's default storage
            path = default_storage.save(filename, file_obj)
            logger.info(f"File uploaded to local storage: {path}")
            return path
        except Exception as e:
            logger.error(f"Local upload failed: {e}")
            raise
    
    def get_url(self, storage_path: str) -> str:
        """Get URL for local file"""
        try:
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            return f"{media_url}{storage_path}"
        except Exception as e:
            logger.error(f"Failed to get local URL: {e}")
            return storage_path
    
    def delete(self, storage_path: str) -> bool:
        """Delete local file"""
        try:
            default_storage.delete(storage_path)
            logger.info(f"Local file deleted: {storage_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete local file: {e}")
            return False
    
    def exists(self, storage_path: str) -> bool:
        """Check if file exists in local storage"""
        try:
            return default_storage.exists(storage_path)
        except Exception as e:
            logger.error(f"Failed to check if file exists: {e}")
            return False
