"""
VideoComment domain entity - Rich domain model with business logic
"""

import uuid
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

from ..value_objects import UserId
from ..events import CommentAdded, CommentUpdated, CommentDeleted


@dataclass
class VideoComment:
    """
    Rich VideoComment domain entity with encapsulated business logic
    This is the single source of truth for comment operations
    """
    
    # Identity
    id: uuid.UUID
    
    # Core data
    exercise_id: uuid.UUID
    author_id: UserId
    text: Optional[str] = None
    video_asset_id: uuid.UUID = None
    
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
        # Video is mandatory for comments
        if not self.video_asset_id:
            raise ValueError("Video asset is required for comments")
        
        # Text is optional but if provided, must not be empty
        if self.text is not None and not self.text.strip():
            raise ValueError("Comment text cannot be empty if provided")
        
        # Text length limit
        if self.text and len(self.text) > 1000:
            raise ValueError("Comment text cannot exceed 1000 characters")
    
    # Business operations
    
    def update_text(self, new_text: str, updated_by: UserId) -> None:
        """Update comment text"""
        if not self.can_be_modified_by(updated_by):
            raise ValueError("User is not authorized to modify this comment")
        
        if new_text is not None and not new_text.strip():
            raise ValueError("Comment text cannot be empty if provided")
        
        if new_text and len(new_text) > 1000:
            raise ValueError("Comment text cannot exceed 1000 characters")
        
        old_text = self.text
        self.text = new_text.strip() if new_text else None
        self.updated_at = datetime.utcnow()
        
        # Raise domain event
        event = CommentUpdated.create(
            self.id,
            updated_by,
            text=self.text if new_text != old_text else None
        )
        self._domain_events.append(event)
    
    def can_be_accessed_by(self, user_id: UserId) -> bool:
        """Check if user can access this comment"""
        # All authenticated users can view comments
        return True
    
    def can_be_modified_by(self, user_id: UserId) -> bool:
        """Check if user can modify this comment"""
        # Only the author can modify the comment
        return self.author_id == user_id
    
    def can_be_deleted_by(self, user_id: UserId) -> bool:
        """Check if user can delete this comment"""
        # Only the author can delete the comment
        return self.author_id == user_id
    
    def has_text(self) -> bool:
        """Check if comment has text content"""
        return self.text is not None and bool(self.text.strip())
    
    def has_video(self) -> bool:
        """Check if comment has video content"""
        return self.video_asset_id is not None
    
    def is_recent(self, hours: int = 24) -> bool:
        """Check if comment was created recently"""
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return self.created_at >= cutoff_time
    
    def get_display_text(self, max_length: int = 200) -> str:
        """Get display text for the comment"""
        if not self.text:
            return ""
        
        if len(self.text) <= max_length:
            return self.text
        
        return self.text[:max_length-3] + "..."
    
    def get_age_display(self) -> str:
        """Get human-readable age of the comment"""
        now = datetime.utcnow()
        age = now - self.created_at
        
        if age.days > 0:
            return f"{age.days} day{'s' if age.days != 1 else ''} ago"
        elif age.seconds > 3600:
            hours = age.seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif age.seconds > 60:
            minutes = age.seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        else:
            return "Just now"
    
    # Domain events
    
    def get_domain_events(self) -> List:
        """Get all uncommitted domain events"""
        return self._domain_events.copy()
    
    def clear_domain_events(self) -> None:
        """Clear all domain events (called after persistence)"""
        self._domain_events.clear()
    
    # Factory methods
    
    @classmethod
    def create(cls, exercise_id: uuid.UUID, author_id: UserId, 
               video_asset_id: uuid.UUID, text: str = None) -> 'VideoComment':
        """Create new video comment"""
        comment = cls(
            id=uuid.uuid4(),
            exercise_id=exercise_id,
            author_id=author_id,
            text=text.strip() if text else None,
            video_asset_id=video_asset_id
        )
        
        # Raise domain event
        event = CommentAdded.create(
            comment.id,
            comment.exercise_id,
            comment.author_id.value,
            comment.text,
            comment.video_asset_id
        )
        comment._domain_events.append(event)
        
        return comment
    
    @classmethod
    def delete(cls, comment_id: uuid.UUID, exercise_id: uuid.UUID, deleted_by: UserId) -> None:
        """Delete comment (creates event but doesn't modify entity)"""
        # This would typically be handled by a domain service
        # that coordinates the deletion process
        event = CommentDeleted.create(comment_id, exercise_id, deleted_by.value)
        # The event would be published by the service
