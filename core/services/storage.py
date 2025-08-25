"""
Video storage service for handling video uploads and storage
"""
import os
import logging
import uuid
from pathlib import Path
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth.models import User
from core.models import VideoAsset
import magic

logger = logging.getLogger(__name__)

class VideoStorageService:
    """Service for handling video storage operations"""
    
    def __init__(self):
        self.video_dir = Path(settings.MEDIA_ROOT) / 'videos'
        self.video_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize cloud storage if available
        try:
            from .cloud_storage import CloudStorageService
            self.cloud_storage = CloudStorageService()
            logger.info("Cloud storage service initialized")
        except ImportError:
            self.cloud_storage = None
            logger.info("Cloud storage not available, using local storage")
        
        # Accepted MIME types for video files
        self.accepted_mime_types = [
            'video/mp4',
            'video/webm', 
            'video/ogg',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-ms-wmv'
        ]
        
        logger.info(f"VideoStorageService initialized: {self.video_dir}")

    def store_uploaded_video(self, uploaded_file, user=None):
        """
        Store uploaded video file and return VideoAsset instance
        
        Args:
            uploaded_file: UploadedFile instance
            user: User who uploaded the file
            
        Returns:
            VideoAsset instance
        """
        try:
            # Validate file
            validation_result = self._validate_video_file(uploaded_file)
            if not validation_result['valid']:
                raise ValueError(validation_result['error'])
            
            # Generate unique filename
            file_extension = Path(uploaded_file.name).suffix.lower()
            if not file_extension:
                file_extension = '.webm'  # Default for webcam recordings
            filename = f"{uuid.uuid4()}{file_extension}"
            
            # Store file using cloud storage if available, otherwise local
            if self.cloud_storage and self.cloud_storage.s3_client:
                try:
                    # Use cloud storage
                    storage_path = self.cloud_storage.store_video(uploaded_file, filename, user)
                    logger.info(f"Video stored in cloud storage: {storage_path}")
                except Exception as cloud_error:
                    logger.warning(f"Cloud storage failed, falling back to local: {cloud_error}")
                    # Fallback to local storage
                    storage_path = default_storage.save(f"videos/{filename}", uploaded_file)
                    logger.info(f"Video stored locally (fallback): {storage_path}")
            else:
                # Fallback to local storage
                storage_path = default_storage.save(f"videos/{filename}", uploaded_file)
                logger.info(f"Video stored locally: {storage_path}")
            
            # Create VideoAsset record
            video_asset = VideoAsset.objects.create(
                orig_filename=uploaded_file.name,
                storage_path=storage_path,
                size_bytes=uploaded_file.size,
                mime_type=validation_result['mime_type']
            )
            
            logger.info(f"VideoAsset created: {video_asset.id} - {filename}")
            return video_asset
            
        except Exception as e:
            logger.error(f"Error storing video: {e}")
            raise

    def _validate_video_file(self, uploaded_file):
        """
        Validate uploaded video file
        
        Returns:
            dict with 'valid' boolean and 'error' string if invalid
        """
        try:
            # Check file size
            if uploaded_file.size == 0:
                return {'valid': False, 'error': 'File is empty'}
            
            # Check file size limit (100MB for Heroku)
            max_size = 100 * 1024 * 1024
            if uploaded_file.size > max_size:
                return {
                    'valid': False, 
                    'error': f'File too large ({uploaded_file.size / 1024 / 1024:.1f}MB). Maximum is 100MB.'
                }
            
            # Detect MIME type
            mime_type = self._detect_mime_type(uploaded_file)
            if not mime_type:
                return {'valid': False, 'error': 'Could not determine file type'}
            
            # Validate MIME type
            if mime_type not in self.accepted_mime_types:
                # Check if it's likely a video file despite MIME type issues
                if not self._is_likely_video_file(uploaded_file):
                    return {
                        'valid': False, 
                        'error': f'Invalid file type: {mime_type}. Expected video file.'
                    }
                # If likely video, use detected MIME type
                logger.warning(f"Using fallback MIME type detection for: {uploaded_file.name}")
            
            return {'valid': True, 'mime_type': mime_type}
            
        except Exception as e:
            logger.error(f"Error validating video file: {e}")
            return {'valid': False, 'error': f'Validation error: {str(e)}'}

    def _detect_mime_type(self, uploaded_file):
        """Detect MIME type using multiple methods with fallback for webcam recordings"""
        try:
            # Method 1: Use python-magic
            if hasattr(magic, 'from_buffer'):
                mime_type = magic.from_buffer(uploaded_file.read(1024), mime=True)
                uploaded_file.seek(0)
                logger.debug(f"MIME type detected by magic: {mime_type}")
                
                # Accept the MIME type if it's in our accepted list
                if mime_type in self.accepted_mime_types:
                    return mime_type
                
                # Special handling for webcam recordings that might be detected as text/plain
                if mime_type == 'text/plain' and self._is_likely_video_file(uploaded_file):
                    logger.info(f"Webcam recording detected as text/plain, using extension-based detection")
                    return self._detect_mime_type_by_extension(uploaded_file)
                
                return mime_type
            
            # Method 2: Fallback to extension-based detection
            return self._detect_mime_type_by_extension(uploaded_file)
            
        except Exception as e:
            logger.warning(f"Error in MIME type detection: {e}")
            return self._detect_mime_type_by_extension(uploaded_file)

    def _detect_mime_type_by_extension(self, uploaded_file):
        """Detect MIME type based on file extension"""
        file_extension = Path(uploaded_file.name).suffix.lower()
        extension_mime_map = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.wmv': 'video/x-ms-wmv'
        }
        return extension_mime_map.get(file_extension, 'video/webm')

    def _is_likely_video_file(self, uploaded_file):
        """Check if a file is likely a video file despite MIME type detection issues"""
        try:
            # Check file extension
            file_extension = Path(uploaded_file.name).suffix.lower()
            video_extensions = ['.mp4', '.webm', '.mov', '.avi']
            
            if file_extension in video_extensions:
                # For webcam recordings, even small files can be valid
                # Check if file size is reasonable (at least 16 bytes for minimal headers)
                if uploaded_file.size >= 16:
                    # Check first few bytes for video file signatures
                    uploaded_file.seek(0)
                    header = uploaded_file.read(16)
                    uploaded_file.seek(0)
                    
                    # Common video file signatures
                    video_signatures = [
                        b'\x00\x00\x00\x18ftyp',  # MP4
                        b'\x1a\x45\xdf\xa3',      # WebM
                        b'\x00\x00\x00\x20ftyp',  # MOV
                        b'RIFF',                   # AVI
                    ]
                    
                    for signature in video_signatures:
                        if header.startswith(signature):
                            logger.info(f"Video signature detected: {signature}")
                            return True
                    
                    # If no signature but extension is video and size is reasonable, assume it's valid
                    logger.info(f"No video signature but extension {file_extension} and size {uploaded_file.size} suggest video file")
                    return True
            
            return False
            
        except Exception as e:
            logger.warning(f"Error checking if file is likely video: {e}")
            return False

    def get_video_url(self, video_asset):
        """Get public URL for video asset"""
        try:
            if self.cloud_storage:
                # Extract filename from storage path
                filename = Path(video_asset.storage_path).name
                return self.cloud_storage.get_video_url(filename)
            else:
                # Use Django's default storage URL
                return default_storage.url(video_asset.storage_path)
        except Exception as e:
            logger.error(f"Error getting video URL: {e}")
            return None

    def delete_video(self, video_asset):
        """Delete video file and asset"""
        try:
            if self.cloud_storage:
                # Extract filename from storage path
                filename = Path(video_asset.storage_path).name
                self.cloud_storage.delete_video(filename)
            else:
                # Delete from local storage
                if default_storage.exists(video_asset.storage_path):
                    default_storage.delete(video_asset.storage_path)
            
            # Delete the database record
            video_asset.delete()
            logger.info(f"Video asset deleted: {video_asset.id}")
            
        except Exception as e:
            logger.error(f"Error deleting video: {e}")
            raise

    def delete_video_asset(self, video_asset):
        """Alias for delete_video method for consistency"""
        return self.delete_video(video_asset)
