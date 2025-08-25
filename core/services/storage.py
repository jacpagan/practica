"""
Simplified storage service for Practika v1
Single interface for local and S3 storage backends
"""

import os
import logging
from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

class LocalStorageBackend:
    """Local file system storage backend"""
    
    def upload(self, file_obj, filename):
        """Upload file to local storage"""
        try:
            # Use Django's default storage
            path = default_storage.save(filename, file_obj)
            logger.info(f"File uploaded to local storage: {path}")
            return path
        except Exception as e:
            logger.error(f"Local upload failed: {e}")
            raise
    
    def get_url(self, storage_path):
        """Get URL for local file"""
        try:
            return default_storage.url(storage_path)
        except Exception as e:
            logger.error(f"Failed to get local URL: {e}")
            return storage_path
    
    def delete(self, storage_path):
        """Delete local file"""
        try:
            default_storage.delete(storage_path)
            logger.info(f"Local file deleted: {storage_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete local file: {e}")
            return False

class S3StorageBackend:
    """S3 storage backend"""
    
    def upload(self, file_obj, filename):
        """Upload file to S3"""
        try:
            # Use Django's default storage (configured for S3)
            path = default_storage.save(filename, file_obj)
            logger.info(f"File uploaded to S3: {path}")
            return path
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise
    
    def get_url(self, storage_path):
        """Get S3 URL for file"""
        try:
            return default_storage.url(storage_path)
        except Exception as e:
            logger.error(f"Failed to get S3 URL: {e}")
            return storage_path
    
    def delete(self, storage_path):
        """Delete S3 file"""
        try:
            default_storage.delete(storage_path)
            logger.info(f"S3 file deleted: {storage_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete S3 file: {e}")
            return False

class VideoStorageService:
    """Main storage service interface"""
    
    def __init__(self):
        self.backend = self._get_backend()
    
    def _get_backend(self):
        """Get appropriate storage backend based on settings"""
        try:
            if getattr(settings, 'USE_S3', False):
                return S3StorageBackend()
            else:
                return LocalStorageBackend()
        except Exception as e:
            logger.error(f"Failed to initialize storage backend: {e}")
            # Fallback to local storage
            return LocalStorageBackend()
    
    def upload_video(self, file_obj, filename):
        """Upload video file"""
        return self.backend.upload(file_obj, filename)
    
    def get_video_url(self, video_asset):
        """Get public URL for video"""
        return self.backend.get_url(video_asset.storage_path)
    
    def delete_video(self, storage_path):
        """Delete video file"""
        return self.backend.delete(storage_path)
