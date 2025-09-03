"""
Domain entities for Practika MVP
Following Domain-Driven Design principles
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Set
from uuid import UUID, uuid4
import hashlib


@dataclass
class VideoAsset:
    """
    Video Asset domain entity
    Represents a video file uploaded by a user
    """
    id: UUID = field(default_factory=uuid4)
    orig_filename: str
    storage_path: str
    size_bytes: int
    duration: float
    uploaded_by_id: UUID
    upload_status: str = "pending"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate domain invariants"""
        if self.size_bytes <= 0:
            raise ValueError("Video size must be positive")
        if self.duration <= 0:
            raise ValueError("Video duration must be positive")
        if not self.orig_filename:
            raise ValueError("Original filename is required")
    
    def is_ready_for_processing(self) -> bool:
        """Check if video is ready for clip processing"""
        return self.upload_status == "completed"
    
    def get_file_extension(self) -> str:
        """Get file extension from original filename"""
        return self.orig_filename.split('.')[-1].lower()
    
    def is_valid_format(self) -> bool:
        """Check if video format is supported"""
        supported_formats = {'mp4', 'webm', 'mov', 'avi'}
        return self.get_file_extension() in supported_formats


@dataclass
class VideoClip:
    """
    Video Clip domain entity
    Represents a cropped segment of a video
    """
    id: UUID = field(default_factory=uuid4)
    original_video_id: UUID
    clip_hash: str
    start_time: float
    end_time: float
    duration: float
    storage_path: str
    size_bytes: Optional[int] = None
    processing_status: str = "pending"
    processing_error: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate domain invariants"""
        if self.start_time < 0:
            raise ValueError("Start time cannot be negative")
        if self.end_time <= self.start_time:
            raise ValueError("End time must be greater than start time")
        if self.duration != self.end_time - self.start_time:
            self.duration = self.end_time - self.start_time
        if not self.clip_hash:
            self.clip_hash = self._generate_clip_hash()
    
    def _generate_clip_hash(self) -> str:
        """Generate unique hash for clip selection"""
        clip_data = f"{self.original_video_id}:{self.start_time:.3f}:{self.end_time:.3f}"
        return hashlib.sha256(clip_data.encode()).hexdigest()
    
    def is_processing_complete(self) -> bool:
        """Check if clip processing is complete"""
        return self.processing_status == "completed"
    
    def is_processing_failed(self) -> bool:
        """Check if clip processing failed"""
        return self.processing_status == "failed"
    
    def mark_as_processing(self):
        """Mark clip as being processed"""
        self.processing_status = "processing"
        self.updated_at = datetime.now()
    
    def mark_as_completed(self, storage_path: str, size_bytes: Optional[int] = None):
        """Mark clip as processing completed"""
        self.processing_status = "completed"
        self.storage_path = storage_path
        self.size_bytes = size_bytes
        self.processed_at = datetime.now()
        self.updated_at = datetime.now()
    
    def mark_as_failed(self, error_message: str):
        """Mark clip as processing failed"""
        self.processing_status = "failed"
        self.processing_error = error_message
        self.updated_at = datetime.now()


@dataclass
class Comment:
    """
    Comment domain entity
    Represents a comment on a video or clip
    """
    id: UUID = field(default_factory=uuid4)
    video_id: UUID
    author_id: UUID
    content: str
    timestamp: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate domain invariants"""
        if not self.content.strip():
            raise ValueError("Comment content cannot be empty")
        if self.timestamp is not None and self.timestamp < 0:
            raise ValueError("Timestamp cannot be negative")
    
    def is_timestamped(self) -> bool:
        """Check if comment has a timestamp"""
        return self.timestamp is not None
    
    def get_content_preview(self, max_length: int = 100) -> str:
        """Get preview of comment content"""
        if len(self.content) <= max_length:
            return self.content
        return self.content[:max_length] + "..."


@dataclass
class User:
    """
    User domain entity
    Represents a user in the system
    """
    id: UUID = field(default_factory=uuid4)
    username: str
    email: str
    is_active: bool = True
    is_staff: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate domain invariants"""
        if not self.username.strip():
            raise ValueError("Username cannot be empty")
        if not self.email.strip():
            raise ValueError("Email cannot be empty")
        if '@' not in self.email:
            raise ValueError("Invalid email format")


@dataclass
class Exercise:
    """
    Exercise domain entity
    Represents an exercise assignment
    """
    id: UUID = field(default_factory=uuid4)
    title: str
    description: str
    created_by_id: UUID
    video_asset_id: Optional[UUID] = None
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate domain invariants"""
        if not self.title.strip():
            raise ValueError("Exercise title cannot be empty")
        if not self.description.strip():
            raise ValueError("Exercise description cannot be empty")


@dataclass
class TeacherStack:
    """
    Teacher Stack domain entity
    Represents exercise × student combination for teacher view
    """
    id: UUID = field(default_factory=uuid4)
    exercise_id: UUID
    student_id: UUID
    submission_count: int = 0
    last_submission_at: Optional[datetime] = None
    latest_clip_id: Optional[UUID] = None
    needs_review: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """Validate domain invariants"""
        if self.submission_count < 0:
            raise ValueError("Submission count cannot be negative")
    
    def add_submission(self, clip_id: UUID):
        """Add a new submission to the stack"""
        self.submission_count += 1
        self.last_submission_at = datetime.now()
        self.latest_clip_id = clip_id
        self.needs_review = True
        self.updated_at = datetime.now()
    
    def mark_as_reviewed(self):
        """Mark stack as reviewed"""
        self.needs_review = False
        self.updated_at = datetime.now()
    
    def has_recent_activity(self, days: int = 7) -> bool:
        """Check if stack has recent activity"""
        if not self.last_submission_at:
            return False
        from datetime import timedelta
        return self.last_submission_at > datetime.now() - timedelta(days=days)


# Domain value objects
@dataclass(frozen=True)
class TimeRange:
    """Value object for time range selection"""
    start_time: float
    end_time: float
    
    def __post_init__(self):
        """Validate time range"""
        if self.start_time < 0:
            raise ValueError("Start time cannot be negative")
        if self.end_time <= self.start_time:
            raise ValueError("End time must be greater than start time")
    
    @property
    def duration(self) -> float:
        """Get duration of time range"""
        return self.end_time - self.start_time
    
    def overlaps_with(self, other: 'TimeRange') -> bool:
        """Check if this time range overlaps with another"""
        return (self.start_time < other.end_time and 
                self.end_time > other.start_time)


@dataclass(frozen=True)
class VideoMetadata:
    """Value object for video metadata"""
    width: int
    height: int
    duration: float
    fps: float
    codec: str
    file_size: int
    
    def __post_init__(self):
        """Validate metadata"""
        if self.width <= 0 or self.height <= 0:
            raise ValueError("Video dimensions must be positive")
        if self.duration <= 0:
            raise ValueError("Video duration must be positive")
        if self.fps <= 0:
            raise ValueError("Video FPS must be positive")
        if self.file_size <= 0:
            raise ValueError("File size must be positive")
    
    @property
    def aspect_ratio(self) -> float:
        """Get aspect ratio of video"""
        return self.width / self.height
    
    @property
    def is_hd(self) -> bool:
        """Check if video is HD quality"""
        return self.height >= 720
    
    @property
    def is_4k(self) -> bool:
        """Check if video is 4K quality"""
        return self.height >= 2160
