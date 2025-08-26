"""
Comment domain events
"""

import uuid
from dataclasses import dataclass
from .base_event import DomainEvent


@dataclass
class CommentAdded(DomainEvent):
    """Event raised when a comment is added"""
    
    exercise_id: uuid.UUID
    author_id: uuid.UUID
    text: str = None
    video_asset_id: uuid.UUID = None
    
    @classmethod
    def create(cls, comment_id: uuid.UUID, exercise_id: uuid.UUID, 
               author_id: uuid.UUID, text: str = None, video_asset_id: uuid.UUID = None) -> 'CommentAdded':
        """Create comment added event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='CommentAdded',
            aggregate_id=comment_id,
            version=1,
            metadata={},
            exercise_id=exercise_id,
            author_id=author_id,
            text=text,
            video_asset_id=video_asset_id
        )


@dataclass
class CommentUpdated(DomainEvent):
    """Event raised when a comment is updated"""
    
    text: str = None
    updated_by: uuid.UUID = None
    
    @classmethod
    def create(cls, comment_id: uuid.UUID, updated_by: uuid.UUID, text: str = None) -> 'CommentUpdated':
        """Create comment updated event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='CommentUpdated',
            aggregate_id=comment_id,
            version=1,
            metadata={},
            text=text,
            updated_by=updated_by
        )


@dataclass
class CommentDeleted(DomainEvent):
    """Event raised when a comment is deleted"""
    
    exercise_id: uuid.UUID
    deleted_by: uuid.UUID
    
    @classmethod
    def create(cls, comment_id: uuid.UUID, exercise_id: uuid.UUID, deleted_by: uuid.UUID) -> 'CommentDeleted':
        """Create comment deleted event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='CommentDeleted',
            aggregate_id=comment_id,
            version=1,
            metadata={},
            exercise_id=exercise_id,
            deleted_by=deleted_by
        )
