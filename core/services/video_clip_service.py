"""
Video clip service for creating and managing video clips with idempotency
"""

import os
import logging
from typing import Optional, Tuple
from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone
import uuid

from core.models import VideoAsset, VideoClip
from core.services.video_processor import video_processor_service

logger = logging.getLogger(__name__)


class VideoClipService:
    """Service for creating and managing video clips with idempotency"""
    
    def create_clip(
        self, 
        video_asset: VideoAsset, 
        start_time: float, 
        end_time: float,
        destination: str = 'exercise'
    ) -> VideoClip:
        """
        Create a video clip with idempotency guarantee
        
        Args:
            video_asset: The source video asset
            start_time: Start time in seconds
            end_time: End time in seconds
            destination: Where the clip will be used ('exercise' or 'comment')
            
        Returns:
            VideoClip instance (existing or newly created)
        """
        try:
            # Generate clip hash for idempotency
            clip_hash = video_processor_service.generate_clip_hash(video_asset, start_time, end_time)
            
            # Check if clip already exists
            existing_clip = VideoClip.objects.filter(clip_hash=clip_hash).first()
            if existing_clip:
                logger.info(f"Found existing clip {existing_clip.id} for hash {clip_hash}")
                return existing_clip
            
            # Validate time range
            if start_time >= end_time:
                raise ValueError("Start time must be less than end time")
            
            if start_time < 0:
                raise ValueError("Start time cannot be negative")
            
            # Get video metadata to validate end time
            metadata = video_processor_service.get_video_metadata(video_asset)
            if metadata.get('duration') and end_time > metadata['duration']:
                raise ValueError(f"End time {end_time}s exceeds video duration {metadata['duration']}s")
            
            # Create clip record
            clip = VideoClip.objects.create(
                original_video=video_asset,
                clip_hash=clip_hash,
                start_time=start_time,
                end_time=end_time,
                duration=end_time - start_time,
                processing_status='pending'
            )
            
            logger.info(f"Created video clip {clip.id} for {video_asset.id} ({start_time}s-{end_time}s)")
            
            # Process the clip asynchronously
            self._process_clip_async(clip)
            
            return clip
            
        except Exception as e:
            logger.error(f"Failed to create clip for {video_asset.id}: {e}")
            raise
    
    def _process_clip_async(self, clip: VideoClip):
        """Process clip asynchronously"""
        try:
            # For MVP, process synchronously. In production, this would be a Celery task
            self._process_clip_sync(clip)
        except Exception as e:
            logger.error(f"Failed to process clip {clip.id}: {e}")
            clip.processing_status = 'failed'
            clip.processing_error = str(e)
            clip.save(update_fields=['processing_status', 'processing_error'])
    
    def _process_clip_sync(self, clip: VideoClip):
        """Process clip synchronously"""
        try:
            clip.processing_status = 'processing'
            clip.save(update_fields=['processing_status'])
            
            # Generate output path
            output_filename = f"clips/{clip.id}.mp4"
            
            # Crop the video
            output_path = video_processor_service.crop_video(
                clip.original_video,
                clip.start_time,
                clip.end_time,
                output_filename
            )
            
            # Get file size
            if hasattr(default_storage, 'size'):
                size_bytes = default_storage.size(output_path)
            else:
                # For S3, we'll need to get size differently
                size_bytes = 0  # Placeholder
            
            # Update clip record
            clip.storage_path = output_path
            clip.size_bytes = size_bytes
            clip.processing_status = 'completed'
            clip.processed_at = timezone.now()
            clip.save()
            
            logger.info(f"Successfully processed clip {clip.id}")
            
        except Exception as e:
            logger.error(f"Failed to process clip {clip.id}: {e}")
            clip.processing_status = 'failed'
            clip.processing_error = str(e)
            clip.save(update_fields=['processing_status', 'processing_error'])
            raise
    
    def get_clip(self, clip_id: str) -> Optional[VideoClip]:
        """Get a video clip by ID"""
        try:
            return VideoClip.objects.get(id=clip_id)
        except VideoClip.DoesNotExist:
            return None
    
    def delete_clip(self, clip: VideoClip) -> bool:
        """Delete a video clip and its file"""
        try:
            # Delete the file
            if default_storage.exists(clip.storage_path):
                default_storage.delete(clip.storage_path)
            
            # Delete the database record
            clip.delete()
            logger.info(f"Deleted clip {clip.id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete clip {clip.id}: {e}")
            return False
    
    def get_clips_for_video(self, video_asset: VideoAsset) -> list:
        """Get all clips for a video asset"""
        return list(VideoClip.objects.filter(original_video=video_asset).order_by('start_time'))


# Global instance for dependency injection
video_clip_service = VideoClipService()
