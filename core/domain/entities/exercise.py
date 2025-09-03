"""
Exercise domain entity - Rich domain model with business logic
"""

import uuid
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

from ..value_objects import UserId
from ..events import ExerciseCreated, ExerciseUpdated, ExerciseDeleted


@dataclass
class Exercise:
    """
    Rich Exercise domain entity with encapsulated business logic
    This is the single source of truth for exercise operations
    """
    
    # Identity
    id: uuid.UUID
    
    # Core data
    name: str
    description: str
    video_asset_id: uuid.UUID
    
    # Ownership
    created_by: UserId
    
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
        if not self.name or not self.name.strip():
            raise ValueError("Exercise name cannot be empty")
        
        if len(self.name.strip()) > 255:
            raise ValueError("Exercise name cannot exceed 255 characters")
        
        if len(self.description) > 2000:
            raise ValueError("Exercise description cannot exceed 2000 characters")
    
    # Business operations
    
    def update_details(self, name: str = None, description: str = None, updated_by: UserId = None) -> None:
        """Update exercise details"""
        if not updated_by:
            raise ValueError("Updated by user ID is required")
        
        # Validate new values
        if name is not None:
            if not name.strip():
                raise ValueError("Exercise name cannot be empty")
            if len(name.strip()) > 255:
                raise ValueError("Exercise name cannot exceed 255 characters")
        
        if description is not None and len(description) > 2000:
            raise ValueError("Exercise description cannot exceed 2000 characters")
        
        # Update fields
        old_name = self.name
        old_description = self.description
        
        if name is not None:
            self.name = name.strip()
        if description is not None:
            self.description = description
        
        self.updated_at = datetime.utcnow()
        
        # Raise domain event
        event = ExerciseUpdated.create(
            self.id,
            updated_by,
            name=self.name if name != old_name else None,
            description=self.description if description != old_description else None
        )
        self._domain_events.append(event)
    
    def can_be_accessed_by(self, user_id: UserId) -> bool:
        """Check if user can access this exercise"""
        # For now, all authenticated users can access exercises
        # This could be extended with more complex permission logic
        return True
    
    def can_be_modified_by(self, user_id: UserId) -> bool:
        """Check if user can modify this exercise"""
        # Only the creator can modify the exercise
        return self.created_by == user_id
    
    def can_be_deleted_by(self, user_id: UserId) -> bool:
        """Check if user can delete this exercise"""
        # Only the creator can delete the exercise
        return self.created_by == user_id
    
    def get_display_name(self) -> str:
        """Get display name for the exercise"""
        return self.name.strip()
    
    def get_short_description(self, max_length: int = 100) -> str:
        """Get shortened description"""
        if len(self.description) <= max_length:
            return self.description
        
        return self.description[:max_length-3] + "..."
    
    def is_recent(self, days: int = 7) -> bool:
        """Check if exercise was created recently"""
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return self.created_at >= cutoff_date
    
    # Domain events
    
    def get_domain_events(self) -> List:
        """Get all uncommitted domain events"""
        return self._domain_events.copy()
    
    def clear_domain_events(self) -> None:
        """Clear all domain events (called after persistence)"""
        self._domain_events.clear()
    
    # Factory methods
    
    @classmethod
    def create(cls, name: str, description: str, video_asset_id: uuid.UUID, created_by: UserId) -> 'Exercise':
        """Create new exercise"""
        exercise = cls(
            id=uuid.uuid4(),
            name=name,
            description=description,
            video_asset_id=video_asset_id,
            created_by=created_by
        )
        
        # Raise domain event
        event = ExerciseCreated.create(
            exercise.id,
            exercise.name,
            exercise.description,
            exercise.video_asset_id,
            exercise.created_by.value
        )
        exercise._domain_events.append(event)
        
        return exercise
    
    @classmethod
    def delete(cls, exercise_id: uuid.UUID, deleted_by: UserId) -> None:
        """Delete exercise (creates event but doesn't modify entity)"""
        # This would typically be handled by a domain service
        # that coordinates the deletion process
        event = ExerciseDeleted.create(exercise_id, deleted_by.value)
        # The event would be published by the service
