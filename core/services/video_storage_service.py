"""
Refactored VideoStorageService following SOLID principles
"""

import uuid
import hashlib
import logging
from typing import Optional
from django.conf import settings
from core.models import VideoAsset
from core.interfaces.storage import StorageBackend, VideoUrlProvider, MimeTypeDetector, FileValidator
from core.services.mime_detector import MimeTypeDetectionService
from core.services.file_validator import FileValidationService
from core.services.video_url_provider import VideoUrlProviderService
from core.registry.storage_backends import create_storage_backend

logger = logging.getLogger(__name__)


class VideoStorageService:
    """Refactored storage service using dependency injection and single responsibility"""
    
    def __init__(
        self,
        storage_backend: Optional[StorageBackend] = None,
        url_provider: Optional[VideoUrlProvider] = None,
        mime_detector: Optional[MimeTypeDetector] = None,
        file_validator: Optional[FileValidator] = None
    ):
        # Dependency injection with default implementations
        self.storage_backend = storage_backend or self._create_default_backend()
        self.url_provider = url_provider or VideoUrlProviderService()
        self.mime_detector = mime_detector or MimeTypeDetectionService()
        self.file_validator = file_validator or FileValidationService()
    
    def _create_default_backend(self) -> StorageBackend:
        """Create default storage backend based on settings"""
        try:
            if getattr(settings, 'USE_S3', False):
                return create_storage_backend('s3')
            else:
                return create_storage_backend('local')
        except Exception as e:
            logger.error(f"Failed to initialize storage backend: {e}")
            # Fallback to local storage
            return create_storage_backend('local')
    
    def get_video_url(self, video_asset: VideoAsset) -> str:
        """Get public URL for video"""
        return self.url_provider.get_video_url(video_asset)
    
    def upload_video(self, file_obj, filename: str) -> str:
        """Upload video file to storage"""
        return self.storage_backend.upload(file_obj, filename)
    
    def delete_video(self, storage_path: str) -> bool:
        """Delete video file from storage"""
        return self.storage_backend.delete(storage_path)
    
    def store_uploaded_video(self, video_file) -> VideoAsset:
        """Store uploaded video and create VideoAsset record"""
        try:
            logger.info(f"Storing uploaded video: {video_file.name}, size: {video_file.size} bytes")
            
            # Validate file first
            is_valid, error_message = self.file_validator.validate_file(video_file)
            if not is_valid:
                raise ValueError(f"File validation failed: {error_message}")
            
            # Generate unique filename
            import os
            file_extension = os.path.splitext(video_file.name)[1]
            unique_filename = f"videos/{uuid.uuid4()}{file_extension}"
            
            logger.info(f"Generated filename: {unique_filename}")
            
            # Detect MIME type
            mime_type = self.mime_detector.detect_mime_type(video_file)
            logger.info(f"Detected MIME type: {mime_type}")
            
            # Validate MIME type
            is_mime_valid, mime_error = self.file_validator.validate_mime_type(mime_type)
            if not is_mime_valid:
                raise ValueError(f"MIME type validation failed: {mime_error}")
            
            # Generate checksum for the file
            checksum = hashlib.sha256(video_file.read()).hexdigest()
            video_file.seek(0)
            
            # Upload file to storage
            storage_path = self.storage_backend.upload(video_file, unique_filename)
            logger.info(f"File uploaded to storage path: {storage_path}")
            
            # Create VideoAsset record with pending status
            video_asset = VideoAsset.objects.create(
                orig_filename=video_file.name,
                storage_path=storage_path,
                mime_type=mime_type,
                size_bytes=video_file.size,
                checksum_sha256=checksum,
                processing_status='pending'
            )

            logger.info(f"Video asset created: {video_asset.id} for file {video_file.name}")

            # Kick off background transcoding
            try:
                from core.services.transcoder import transcode_video
                transcode_video.delay(str(video_asset.id))
            except Exception as exc:
                logger.warning(f"Celery not available, running sync transcode: {exc}")
                from core.services.transcoder import transcode_video_sync
                transcode_video_sync(str(video_asset.id))

            return video_asset
            
        except Exception as e:
            logger.error(f"Failed to store uploaded video: {e}")
            raise
    
    def create_youtube_video_asset(self, youtube_url: str) -> VideoAsset:
        """Create VideoAsset record for YouTube video"""
        try:
            logger.info(f"Creating YouTube video asset for URL: {youtube_url}")
            
            # Validate YouTube URL
            if not self._is_valid_youtube_url(youtube_url):
                raise ValueError("Invalid YouTube URL format")
            
            # Extract video ID
            video_id = self._extract_youtube_video_id(youtube_url)
            if not video_id:
                raise ValueError("Could not extract video ID from YouTube URL")
            
            # Create VideoAsset record for YouTube video
            video_asset = VideoAsset.objects.create(
                orig_filename=f"youtube_{video_id}.mp4",
                youtube_url=youtube_url,
                mime_type="video/youtube",
                video_type="youtube",
                processing_status='completed'  # YouTube videos are already processed
            )
            
            logger.info(f"YouTube video asset created: {video_asset.id} for video ID {video_id}")
            return video_asset
            
        except Exception as e:
            logger.error(f"Failed to create YouTube video asset: {e}")
            raise
    
    def _is_valid_youtube_url(self, url: str) -> bool:
        """Validate YouTube URL format"""
        import re
        patterns = [
            r'^https?://(?:www\.)?youtube\.com/watch\?v=[a-zA-Z0-9_-]{11}',
            r'^https?://youtu\.be/[a-zA-Z0-9_-]{11}',
            r'^https?://(?:www\.)?youtube\.com/embed/[a-zA-Z0-9_-]{11}'
        ]
        return any(re.match(pattern, url) for pattern in patterns)
    
    def _extract_youtube_video_id(self, url: str) -> str:
        """Extract video ID from YouTube URL"""
        import re
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def delete_video_asset(self, video_asset: VideoAsset) -> bool:
        """Delete video asset and associated file"""
        try:
            # Delete the file
            if self.storage_backend.delete(video_asset.storage_path):
                # Delete the database record
                video_asset.delete()
                logger.info(f"Video asset deleted: {video_asset.id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete video asset: {e}")
            return False
