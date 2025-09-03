"""
Video URL provider service - Single Responsibility
"""

import logging
from django.conf import settings
from django.core.files.storage import default_storage
from core.interfaces.storage import VideoUrlProvider

logger = logging.getLogger(__name__)


class VideoUrlProviderService(VideoUrlProvider):
    """Service responsible only for generating video URLs"""
    
    def get_video_url(self, video_asset) -> str:
        """Get public URL for video asset"""
        try:
            if getattr(settings, 'USE_S3', False):
                # For S3, use the default storage URL
                return default_storage.url(video_asset.storage_path)
            else:
                # For local storage, construct the URL
                media_url = getattr(settings, 'MEDIA_URL', '/media/')
                return f"{media_url}{video_asset.storage_path}"
        except Exception as e:
            logger.error(f"Failed to get video URL: {e}")
            return video_asset.storage_path
