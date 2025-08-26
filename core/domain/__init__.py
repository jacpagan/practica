"""
Domain layer - The core of the application
Contains entities, value objects, domain services, and events
"""

from .entities import VideoAsset, Exercise, VideoComment
from .value_objects import VideoMetadata, FileInfo, ProcessingStatus, UserId
from .domain_services import VideoProcessingService, ExerciseManagementService, CommentModerationService
from .events import (
    VideoUploaded, VideoProcessingStarted, VideoProcessingCompleted, VideoProcessingFailed,
    ExerciseCreated, ExerciseUpdated, ExerciseDeleted,
    CommentAdded, CommentUpdated, CommentDeleted
)

__all__ = [
    # Entities
    'VideoAsset',
    'Exercise', 
    'VideoComment',
    
    # Value Objects
    'VideoMetadata',
    'FileInfo',
    'ProcessingStatus',
    'UserId',
    
    # Domain Services
    'VideoProcessingService',
    'ExerciseManagementService',
    'CommentModerationService',
    
    # Events
    'VideoUploaded',
    'VideoProcessingStarted',
    'VideoProcessingCompleted', 
    'VideoProcessingFailed',
    'ExerciseCreated',
    'ExerciseUpdated',
    'ExerciseDeleted',
    'CommentAdded',
    'CommentUpdated',
    'CommentDeleted'
]
