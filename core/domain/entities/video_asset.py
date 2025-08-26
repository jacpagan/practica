"""
VideoAsset domain entity - Rich domain model with business logic
"""

import uuid
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

from ..value_objects import FileInfo, VideoMetadata, ProcessingStatus
from ..events import VideoUploaded, VideoProcessingStarted, VideoProcessingCompleted, VideoProcessingFailed


@dataclass
class VideoAsset:
    """
    Rich VideoAsset domain entity with encapsulated business logic
    This is the single source of truth for video asset operations
    """
    
    # Identity
    id: uuid.UUID
    
    # Core data
    file_info: FileInfo
    storage_path: str
    
    # Video metadata
    video_metadata: Optional[VideoMetadata] = None
    poster_path: Optional[str] = None
    
    # Processing
    processing_status: ProcessingStatus = field(default_factory=ProcessingStatus.pending)
    
    # Validation and access
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # Domain events
    _domain_events: List = field(default_factory=list, init=False)
    
    def __post_init__(self):
        """Validate entity invariants"""
        self._validate_invariants()
    
    def _validate_invariants(self):
        """Validate business rules and invariants"""
        if not self.storage_path or not self.storage_path.strip():
            raise ValueError("Storage path cannot be empty")
        
        if not self.file_info.is_video():
            raise ValueError("File must be a video")
        
        if not self.file_info.is_valid_size():
            raise ValueError("File size exceeds maximum allowed size")
    
    # Business operations
    
    def start_processing(self, processing_job_id: str) -> None:
        """Start video processing"""
        if not self.processing_status.is_pending():
            raise ValueError("Can only start processing from pending status")
        
        self.processing_status = ProcessingStatus.processing()
        self.updated_at = datetime.utcnow()
        
        # Raise domain event
        event = VideoProcessingStarted.create(self.id, processing_job_id)
        self._domain_events.append(event)
    
    def complete_processing(self, video_metadata: VideoMetadata, poster_path: str) -> None:
        """Complete video processing"""
        if not self.processing_status.is_processing():
            raise ValueError("Can only complete processing from processing status")
        
        self.video_metadata = video_metadata
        self.poster_path = poster_path
        self.processing_status = ProcessingStatus.completed()
        self.updated_at = datetime.utcnow()
        
        # Raise domain event
        event = VideoProcessingCompleted.create(
            self.id, 
            self._video_metadata_to_dict(video_metadata), 
            poster_path
        )
        self._domain_events.append(event)
    
    def fail_processing(self, error_message: str, error_code: str = None) -> None:
        """Fail video processing"""
        if not self.processing_status.is_processing():
            raise ValueError("Can only fail processing from processing status")
        
        self.processing_status = ProcessingStatus.failed(error_message)
        self.updated_at = datetime.utcnow()
        
        # Raise domain event
        event = VideoProcessingFailed.create(self.id, error_message, error_code)
        self._domain_events.append(event)
    
    def mark_as_invalid(self, validation_errors: List[str]) -> None:
        """Mark video as invalid with specific errors"""
        self.is_valid = False
        self.validation_errors = validation_errors
        self.updated_at = datetime.utcnow()
    
    def mark_as_valid(self) -> None:
        """Mark video as valid"""
        self.is_valid = True
        self.validation_errors = []
        self.updated_at = datetime.utcnow()
    
    def record_access(self) -> None:
        """Record that the video was accessed"""
        self.access_count += 1
        self.last_accessed = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def can_be_deleted(self) -> bool:
        """Check if video can be safely deleted"""
        return self.processing_status.is_completed() or self.processing_status.is_failed()
    
    def is_ready_for_playback(self) -> bool:
        """Check if video is ready for playback"""
        return (self.processing_status.is_completed() and 
                self.is_valid and 
                self.video_metadata is not None)
    
    def get_duration_display(self) -> str:
        """Get human-readable duration"""
        if not self.video_metadata or not self.video_metadata.duration_sec:
            return "Unknown"
        
        duration = self.video_metadata.duration_sec
        minutes = duration // 60
        seconds = duration % 60
        return f"{minutes}:{seconds:02d}"
    
    def get_size_display(self) -> str:
        """Get human-readable file size"""
        size_mb = self.file_info.size_mb
        if size_mb < 1:
            return f"{self.file_info.size_bytes} bytes"
        elif size_mb < 1024:
            return f"{size_mb:.1f} MB"
        else:
            return f"{size_mb/1024:.1f} GB"
    
    # Domain events
    
    def get_domain_events(self) -> List:
        """Get all uncommitted domain events"""
        return self._domain_events.copy()
    
    def clear_domain_events(self) -> None:
        """Clear all domain events (called after persistence)"""
        self._domain_events.clear()
    
    # Factory methods
    
    @classmethod
    def create_from_upload(cls, file_info: FileInfo, storage_path: str) -> 'VideoAsset':
        """Create VideoAsset from uploaded file"""
        video_asset = cls(
            id=uuid.uuid4(),
            file_info=file_info,
            storage_path=storage_path
        )
        
        # Raise domain event
        event = VideoUploaded.create(
            video_asset.id,
            video_asset._file_info_to_dict(file_info),
            storage_path
        )
        video_asset._domain_events.append(event)
        
        return video_asset
    
    # Helper methods
    
    def _file_info_to_dict(self, file_info: FileInfo) -> dict:
        """Convert FileInfo to dictionary for events"""
        return {
            'original_filename': file_info.original_filename,
            'mime_type': file_info.mime_type,
            'size_bytes': file_info.size_bytes,
            'checksum_sha256': file_info.checksum_sha256
        }
    
    def _video_metadata_to_dict(self, video_metadata: VideoMetadata) -> dict:
        """Convert VideoMetadata to dictionary for events"""
        return {
            'duration_sec': video_metadata.duration_sec,
            'width': video_metadata.width,
            'height': video_metadata.height,
            'frame_rate': video_metadata.frame_rate,
            'bitrate': video_metadata.bitrate
        }
