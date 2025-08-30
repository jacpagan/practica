"""
Domain events for Practika MVP
Following Domain-Driven Design principles
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4


@dataclass
class DomainEvent(ABC):
    """
    Base class for all domain events
    """
    event_id: UUID = field(default_factory=uuid4)
    occurred_on: datetime = field(default_factory=datetime.now)
    event_type: str = field(init=False)
    
    def __post_init__(self):
        self.event_type = self.__class__.__name__


@dataclass
class VideoUploaded(DomainEvent):
    """Event raised when a video is uploaded"""
    video_id: UUID
    filename: str
    size_bytes: int
    uploaded_by_id: UUID
    storage_path: str


@dataclass
class VideoProcessingStarted(DomainEvent):
    """Event raised when video processing begins"""
    video_id: UUID
    processing_type: str  # 'metadata', 'clip', etc.


@dataclass
class VideoProcessingCompleted(DomainEvent):
    """Event raised when video processing completes"""
    video_id: UUID
    processing_type: str
    result_path: str
    processing_time_seconds: float


@dataclass
class VideoProcessingFailed(DomainEvent):
    """Event raised when video processing fails"""
    video_id: UUID
    processing_type: str
    error_message: str
    error_code: Optional[str] = None


@dataclass
class ClipCreated(DomainEvent):
    """Event raised when a video clip is created"""
    clip_id: UUID
    video_id: UUID
    start_time: float
    end_time: float
    duration: float
    created_by_id: UUID


@dataclass
class ClipProcessingStarted(DomainEvent):
    """Event raised when clip processing begins"""
    clip_id: UUID
    video_id: UUID


@dataclass
class ClipProcessingCompleted(DomainEvent):
    """Event raised when clip processing completes"""
    clip_id: UUID
    video_id: UUID
    output_path: str
    file_size: int
    processing_time_seconds: float


@dataclass
class ClipProcessingFailed(DomainEvent):
    """Event raised when clip processing fails"""
    clip_id: UUID
    video_id: UUID
    error_message: str


@dataclass
class CommentAdded(DomainEvent):
    """Event raised when a comment is added"""
    comment_id: UUID
    video_id: UUID
    author_id: UUID
    content: str
    timestamp: Optional[float] = None


@dataclass
class CommentUpdated(DomainEvent):
    """Event raised when a comment is updated"""
    comment_id: UUID
    video_id: UUID
    author_id: UUID
    old_content: str
    new_content: str


@dataclass
class CommentDeleted(DomainEvent):
    """Event raised when a comment is deleted"""
    comment_id: UUID
    video_id: UUID
    author_id: UUID


@dataclass
class UserRegistered(DomainEvent):
    """Event raised when a user registers"""
    user_id: UUID
    username: str
    email: str


@dataclass
class UserLoggedIn(DomainEvent):
    """Event raised when a user logs in"""
    user_id: UUID
    username: str
    ip_address: Optional[str] = None


@dataclass
class ExerciseCreated(DomainEvent):
    """Event raised when an exercise is created"""
    exercise_id: UUID
    title: str
    created_by_id: UUID
    video_asset_id: Optional[UUID] = None


@dataclass
class ExerciseSubmitted(DomainEvent):
    """Event raised when an exercise is submitted"""
    exercise_id: UUID
    student_id: UUID
    clip_id: UUID
    submission_count: int


@dataclass
class TeacherStackCreated(DomainEvent):
    """Event raised when a teacher stack is created"""
    stack_id: UUID
    exercise_id: UUID
    student_id: UUID


@dataclass
class TeacherStackUpdated(DomainEvent):
    """Event raised when a teacher stack is updated"""
    stack_id: UUID
    exercise_id: UUID
    student_id: UUID
    submission_count: int
    needs_review: bool


@dataclass
class TeacherStackReviewed(DomainEvent):
    """Event raised when a teacher stack is reviewed"""
    stack_id: UUID
    exercise_id: UUID
    student_id: UUID
    reviewed_by_id: UUID


# Event handlers
class DomainEventHandler(ABC):
    """Base class for domain event handlers"""
    
    @abstractmethod
    def handle(self, event: DomainEvent) -> None:
        """Handle a domain event"""
        pass


class DomainEventBus:
    """
    Simple domain event bus for publishing and subscribing to events
    """
    
    def __init__(self):
        self._handlers: Dict[str, List[DomainEventHandler]] = {}
    
    def subscribe(self, event_type: str, handler: DomainEventHandler) -> None:
        """Subscribe to an event type"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    def publish(self, event: DomainEvent) -> None:
        """Publish an event to all subscribers"""
        event_type = event.event_type
        if event_type in self._handlers:
            for handler in self._handlers[event_type]:
                try:
                    handler.handle(event)
                except Exception as e:
                    # Log error but don't stop other handlers
                    print(f"Error handling event {event_type}: {e}")
    
    def unsubscribe(self, event_type: str, handler: DomainEventHandler) -> None:
        """Unsubscribe from an event type"""
        if event_type in self._handlers:
            self._handlers[event_type].remove(handler)


# Global event bus instance
domain_event_bus = DomainEventBus()


# Event handler implementations
class VideoUploadEventHandler(DomainEventHandler):
    """Handles video upload events"""
    
    def handle(self, event: DomainEvent) -> None:
        if isinstance(event, VideoUploaded):
            print(f"Video uploaded: {event.video_id} by {event.uploaded_by_id}")
            # Here you could trigger metadata extraction, thumbnail generation, etc.


class ClipCreationEventHandler(DomainEventHandler):
    """Handles clip creation events"""
    
    def handle(self, event: DomainEvent) -> None:
        if isinstance(event, ClipCreated):
            print(f"Clip created: {event.clip_id} from video {event.video_id}")
            # Here you could trigger clip processing, notification to teacher, etc.


class CommentEventHandler(DomainEventHandler):
    """Handles comment events"""
    
    def handle(self, event: DomainEvent) -> None:
        if isinstance(event, CommentAdded):
            print(f"Comment added: {event.comment_id} to video {event.video_id}")
            # Here you could trigger notifications, analytics, etc.


class TeacherStackEventHandler(DomainEventHandler):
    """Handles teacher stack events"""
    
    def handle(self, event: DomainEvent) -> None:
        if isinstance(event, TeacherStackUpdated):
            if event.needs_review:
                print(f"Teacher stack needs review: {event.stack_id}")
                # Here you could trigger notifications to teacher, etc.


# Register default handlers
domain_event_bus.subscribe("VideoUploaded", VideoUploadEventHandler())
domain_event_bus.subscribe("ClipCreated", ClipCreationEventHandler())
domain_event_bus.subscribe("CommentAdded", CommentEventHandler())
domain_event_bus.subscribe("TeacherStackUpdated", TeacherStackEventHandler())
