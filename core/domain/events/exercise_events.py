"""
Exercise domain events
"""

import uuid
from dataclasses import dataclass
from .base_event import DomainEvent


@dataclass
class ExerciseCreated(DomainEvent):
    """Event raised when an exercise is created"""
    
    name: str = None
    description: str = None
    video_asset_id: uuid.UUID = None
    created_by: uuid.UUID = None
    
    @classmethod
    def create(cls, exercise_id: uuid.UUID, name: str, description: str, 
               video_asset_id: uuid.UUID, created_by: uuid.UUID) -> 'ExerciseCreated':
        """Create exercise created event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='ExerciseCreated',
            aggregate_id=exercise_id,
            version=1,
            metadata={},
            name=name,
            description=description,
            video_asset_id=video_asset_id,
            created_by=created_by
        )


@dataclass
class ExerciseUpdated(DomainEvent):
    """Event raised when an exercise is updated"""
    
    name: str = None
    description: str = None
    updated_by: uuid.UUID = None
    
    @classmethod
    def create(cls, exercise_id: uuid.UUID, updated_by: uuid.UUID, 
               name: str = None, description: str = None) -> 'ExerciseUpdated':
        """Create exercise updated event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='ExerciseUpdated',
            aggregate_id=exercise_id,
            version=1,
            metadata={},
            name=name,
            description=description,
            updated_by=updated_by
        )


@dataclass
class ExerciseDeleted(DomainEvent):
    """Event raised when an exercise is deleted"""
    
    deleted_by: uuid.UUID = None
    
    @classmethod
    def create(cls, exercise_id: uuid.UUID, deleted_by: uuid.UUID) -> 'ExerciseDeleted':
        """Create exercise deleted event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=cls._get_utc_now(),
            event_type='ExerciseDeleted',
            aggregate_id=exercise_id,
            version=1,
            metadata={},
            deleted_by=deleted_by
        )
