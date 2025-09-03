"""
Video processing domain service
"""

import uuid
from typing import Protocol, List
from datetime import datetime

from ..entities import VideoAsset
from ..value_objects import FileInfo, VideoMetadata, ProcessingStatus
from ..events import VideoProcessingStarted, VideoProcessingCompleted, VideoProcessingFailed


class VideoProcessor(Protocol):
    """Protocol for video processing operations"""
    
    def extract_metadata(self, video_path: str) -> VideoMetadata:
        """Extract video metadata"""
        ...
    
    def generate_poster(self, video_path: str) -> str:
        """Generate video poster image"""
        ...
    
    def validate_video(self, video_path: str) -> List[str]:
        """Validate video file and return any errors"""
        ...


class VideoProcessingService:
    """
    Domain service for video processing operations
    Handles complex business logic that doesn't belong to a single entity
    """
    
    def __init__(self, video_processor: VideoProcessor):
        self.video_processor = video_processor
    
    def start_processing(self, video_asset: VideoAsset) -> str:
        """
        Start video processing workflow
        Returns processing job ID
        """
        if not video_asset.processing_status.is_pending():
            raise ValueError("Video must be in pending status to start processing")
        
        # Generate processing job ID
        processing_job_id = f"job_{video_asset.id}_{int(datetime.utcnow().timestamp())}"
        
        # Start processing
        video_asset.start_processing(processing_job_id)
        
        return processing_job_id
    
    def complete_processing(self, video_asset: VideoAsset, video_path: str) -> None:
        """
        Complete video processing workflow
        """
        if not video_asset.processing_status.is_processing():
            raise ValueError("Video must be in processing status to complete")
        
        try:
            # Extract video metadata
            video_metadata = self.video_processor.extract_metadata(video_path)
            
            # Generate poster image
            poster_path = self.video_processor.generate_poster(video_path)
            
            # Complete processing
            video_asset.complete_processing(video_metadata, poster_path)
            
        except Exception as e:
            # Handle processing errors
            video_asset.fail_processing(str(e), "PROCESSING_ERROR")
            raise
    
    def validate_video_file(self, video_asset: VideoAsset, video_path: str) -> None:
        """
        Validate video file and update asset status
        """
        try:
            # Validate video file
            validation_errors = self.video_processor.validate_video(video_path)
            
            if validation_errors:
                video_asset.mark_as_invalid(validation_errors)
            else:
                video_asset.mark_as_valid()
                
        except Exception as e:
            video_asset.mark_as_invalid([f"Validation failed: {str(e)}"])
    
    def can_process_video(self, video_asset: VideoAsset) -> bool:
        """
        Check if video can be processed
        """
        return (video_asset.processing_status.is_pending() and 
                video_asset.is_valid and
                video_asset.file_info.is_video())
    
    def get_processing_priority(self, video_asset: VideoAsset) -> int:
        """
        Calculate processing priority based on business rules
        Higher number = higher priority
        """
        priority = 0
        
        # Prioritize smaller files (faster processing)
        if video_asset.file_info.size_mb < 10:
            priority += 10
        elif video_asset.file_info.size_mb < 50:
            priority += 5
        
        # Prioritize recent uploads
        if video_asset.is_recent():
            priority += 5
        
        # Prioritize valid files
        if video_asset.is_valid:
            priority += 3
        
        return priority
    
    def estimate_processing_time(self, video_asset: VideoAsset) -> int:
        """
        Estimate processing time in seconds
        """
        # Base time for metadata extraction
        base_time = 30
        
        # Add time based on file size
        size_factor = video_asset.file_info.size_mb * 2
        
        # Add time based on duration (if available)
        duration_factor = 0
        if video_asset.video_metadata and video_asset.video_metadata.duration_sec:
            duration_factor = video_asset.video_metadata.duration_sec * 0.5
        
        return int(base_time + size_factor + duration_factor)
