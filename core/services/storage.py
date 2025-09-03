"""
Legacy storage service - maintained for backward compatibility
New code should use the refactored services in core.services.video_storage_service
"""

import os
import logging
from django.conf import settings
from django.core.files.storage import default_storage
from core.container import container

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
            from django.conf import settings
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            return f"{media_url}{storage_path}"
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
        """Get S3 storage URL for file"""
        try:
            from django.conf import settings
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
    """Legacy storage service - delegates to new refactored service"""
    
    def __init__(self):
        # Delegate to the new refactored service
        self._service = container.get_video_storage_service()
    
    def _get_backend(self):
        """Legacy method - delegates to new service"""
        return self._service.storage_backend
    
    def get_video_url(self, video_asset):
        """Get public URL for video - delegates to new service"""
        return self._service.get_video_url(video_asset)
    
    def upload_video(self, file_obj, filename):
        """Upload video file - delegates to new service"""
        return self._service.upload_video(file_obj, filename)
    
    def delete_video(self, storage_path):
        """Delete video file - delegates to new service"""
        return self._service.delete_video(storage_path)
    
    def store_uploaded_video(self, video_file):
        """Store uploaded video and create VideoAsset record - delegates to new service"""
        return self._service.store_uploaded_video(video_file)
    
    def delete_video_asset(self, video_asset):
        """Delete video asset and associated file - delegates to new service"""
        return self._service.delete_video_asset(video_asset)
    
    def _get_mime_type_from_extension(self, extension):
        """Legacy method - delegates to new service"""
        return self._service.mime_detector._get_mime_type_from_extension(extension)
