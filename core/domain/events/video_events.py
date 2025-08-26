"""
Video domain events
"""

import uuid
from dataclasses import dataclass
from .base_event import DomainEvent


@dataclass
class VideoUploaded(DomainEvent):
    """Event raised when a video is uploaded"""
    
    file_info: dict  # FileInfo as dict
    storage_path: str
    
    @classmethod
    def create(cls, video_id: uuid.UUID, file_info: dict, storage_path: str) -> 'VideoUploaded':
        """Create video uploaded event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='VideoUploaded',
            aggregate_id=video_id,
            version=1,
            metadata={},
            file_info=file_info,
            storage_path=storage_path
        )


@dataclass
class VideoProcessingStarted(DomainEvent):
    """Event raised when video processing starts"""
    
    processing_job_id: str
    
    @classmethod
    def create(cls, video_id: uuid.UUID, processing_job_id: str) -> 'VideoProcessingStarted':
        """Create video processing started event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='VideoProcessingStarted',
            aggregate_id=video_id,
            version=1,
            metadata={},
            processing_job_id=processing_job_id
        )


@dataclass
class VideoProcessingCompleted(DomainEvent):
    """Event raised when video processing completes"""
    
    video_metadata: dict  # VideoMetadata as dict
    poster_path: str
    
    @classmethod
    def create(cls, video_id: uuid.UUID, video_metadata: dict, poster_path: str) -> 'VideoProcessingCompleted':
        """Create video processing completed event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='VideoProcessingCompleted',
            aggregate_id=video_id,
            version=1,
            metadata={},
            video_metadata=video_metadata,
            poster_path=poster_path
        )


@dataclass
class VideoProcessingFailed(DomainEvent):
    """Event raised when video processing fails"""
    
    error_message: str
    error_code: str = None
    
    @classmethod
    def create(cls, video_id: uuid.UUID, error_message: str, error_code: str = None) -> 'VideoProcessingFailed':
        """Create video processing failed event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='VideoProcessingFailed',
            aggregate_id=video_id,
            version=1,
            metadata={},
            error_message=error_message,
            error_code=error_code
        )
