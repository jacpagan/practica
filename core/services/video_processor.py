"""
Video processing service for server-side clip cropping and comparison generation
"""

import os
import logging
import hashlib
import tempfile
from typing import Tuple, Optional
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone
import uuid

try:
    import ffmpeg
except ImportError:
    ffmpeg = None

from core.models import VideoAsset

logger = logging.getLogger(__name__)


class VideoProcessorService:
    """Service for server-side video processing including clip cropping"""
    
    def __init__(self):
        self.ffmpeg_available = ffmpeg is not None
        if not self.ffmpeg_available:
            logger.warning("FFmpeg not available. Video processing will be limited.")
    
    def crop_video(self, video_asset: VideoAsset, start_time: float, end_time: float, output_path: str) -> str:
        """
        Crop a video to a specific time range
        
        Args:
            video_asset: The source video asset
            start_time: Start time in seconds
            end_time: End time in seconds
            output_path: Where to save the cropped video
            
        Returns:
            Path to the cropped video file
        """
        if not self.ffmpeg_available:
            raise RuntimeError("FFmpeg not available for video processing")
        
        try:
            # Get the video file path
            if hasattr(default_storage, 'path'):
                input_path = default_storage.path(video_asset.storage_path)
            else:
                # For S3, download to temp file first
                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                    with default_storage.open(video_asset.storage_path, 'rb') as source_file:
                        temp_file.write(source_file.read())
                    input_path = temp_file.name
            
            # Calculate duration
            duration = end_time - start_time
            
            # Create output directory if needed
            output_dir = os.path.dirname(output_path)
            if not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            # Process video with FFmpeg
            stream = ffmpeg.input(input_path, ss=start_time, t=duration)
            stream = ffmpeg.output(stream, output_path, acodec='copy', vcodec='copy')
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            # Clean up temp file if created
            if not hasattr(default_storage, 'path'):
                os.unlink(input_path)
            
            logger.info(f"Successfully cropped video {video_asset.id} from {start_time}s to {end_time}s")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to crop video {video_asset.id}: {e}")
            raise
    
    def create_comparison_clip(self, original_video: VideoAsset, reply_video: VideoAsset, output_path: str) -> str:
        """
        Create a side-by-side comparison video
        
        Args:
            original_video: The original exercise video
            reply_video: The reply video
            output_path: Where to save the comparison video
            
        Returns:
            Path to the comparison video file
        """
        if not self.ffmpeg_available:
            raise RuntimeError("FFmpeg not available for video processing")
        
        try:
            # Get video file paths
            original_path = self._get_video_path(original_video)
            reply_path = self._get_video_path(reply_video)
            
            # Create output directory
            output_dir = os.path.dirname(output_path)
            if not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            # Create side-by-side comparison
            # Scale both videos to same height and place side by side
            original_stream = ffmpeg.input(original_path).filter('scale', -1, 480)
            reply_stream = ffmpeg.input(reply_path).filter('scale', -1, 480)
            
            # Combine videos side by side
            combined = ffmpeg.filter([original_stream, reply_stream], 'hstack')
            
            # Add labels
            labeled = combined.filter('drawtext', text='Original', x=10, y=10, fontsize=24, fontcolor='white')
            labeled = labeled.filter('drawtext', text='Reply', x=10, y=10, fontsize=24, fontcolor='white')
            
            # Output
            stream = ffmpeg.output(labeled, output_path)
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            # Clean up temp files
            self._cleanup_temp_files([original_path, reply_path])
            
            logger.info(f"Successfully created comparison video for {original_video.id} and {reply_video.id}")
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to create comparison video: {e}")
            raise
    
    def _get_video_path(self, video_asset: VideoAsset) -> str:
        """Get local file path for video asset"""
        if hasattr(default_storage, 'path'):
            return default_storage.path(video_asset.storage_path)
        else:
            # Download to temp file for S3
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                with default_storage.open(video_asset.storage_path, 'rb') as source_file:
                    temp_file.write(source_file.read())
                return temp_file.name
    
    def _cleanup_temp_files(self, file_paths: list):
        """Clean up temporary files"""
        for path in file_paths:
            if not hasattr(default_storage, 'path') and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {path}: {e}")
    
    def generate_clip_hash(self, video_asset: VideoAsset, start_time: float, end_time: float) -> str:
        """
        Generate a unique hash for a video clip selection
        
        Args:
            video_asset: The video asset
            start_time: Start time in seconds
            end_time: End time in seconds
            
        Returns:
            SHA256 hash of the clip selection
        """
        # Create a unique identifier for this clip selection
        clip_data = f"{video_asset.id}:{start_time:.3f}:{end_time:.3f}"
        return hashlib.sha256(clip_data.encode()).hexdigest()
    
    def get_video_metadata(self, video_asset: VideoAsset) -> dict:
        """
        Get video metadata using FFmpeg
        
        Args:
            video_asset: The video asset
            
        Returns:
            Dictionary with video metadata
        """
        if not self.ffmpeg_available:
            return {}
        
        try:
            video_path = self._get_video_path(video_asset)
            probe = ffmpeg.probe(video_path)
            
            video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)
            if video_stream:
                return {
                    'width': int(video_stream.get('width', 0)),
                    'height': int(video_stream.get('height', 0)),
                    'duration': float(video_stream.get('duration', 0)),
                    'fps': eval(video_stream.get('r_frame_rate', '0/1')),
                    'codec': video_stream.get('codec_name', 'unknown')
                }
            return {}
            
        except Exception as e:
            logger.error(f"Failed to get video metadata for {video_asset.id}: {e}")
            return {}


# Global instance for dependency injection
video_processor_service = VideoProcessorService()
