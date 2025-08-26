"""
Exercise management domain service
"""

import uuid
from typing import List, Protocol
from datetime import datetime, timedelta

from ..entities import Exercise, VideoAsset
from ..value_objects import UserId


class ExerciseRepository(Protocol):
    """Protocol for exercise repository operations"""
    
    def save(self, exercise: Exercise) -> Exercise:
        """Save exercise"""
        ...
    
    def find_by_id(self, exercise_id: uuid.UUID) -> Exercise:
        """Find exercise by ID"""
        ...
    
    def find_all(self) -> List[Exercise]:
        """Find all exercises"""
        ...
    
    def find_by_creator(self, creator_id: UserId) -> List[Exercise]:
        """Find exercises by creator"""
        ...
    
    def delete(self, exercise_id: uuid.UUID) -> None:
        """Delete exercise"""
        ...


class VideoAssetRepository(Protocol):
    """Protocol for video asset repository operations"""
    
    def find_by_id(self, video_asset_id: uuid.UUID) -> VideoAsset:
        """Find video asset by ID"""
        ...


class ExerciseManagementService:
    """
    Domain service for exercise management operations
    Handles complex business logic involving exercises and video assets
    """
    
    def __init__(self, exercise_repository: ExerciseRepository, video_asset_repository: VideoAssetRepository):
        self.exercise_repository = exercise_repository
        self.video_asset_repository = video_asset_repository
    
    def create_exercise(self, name: str, description: str, video_asset_id: uuid.UUID, created_by: UserId) -> Exercise:
        """
        Create new exercise with business rule validation
        """
        # Validate video asset exists and is ready
        video_asset = self.video_asset_repository.find_by_id(video_asset_id)
        if not video_asset:
            raise ValueError("Video asset not found")
        
        if not video_asset.is_ready_for_playback():
            raise ValueError("Video asset is not ready for playback")
        
        # Create exercise
        exercise = Exercise.create(name, description, video_asset_id, created_by)
        
        # Save exercise
        return self.exercise_repository.save(exercise)
    
    def update_exercise(self, exercise_id: uuid.UUID, name: str = None, description: str = None, updated_by: UserId = None) -> Exercise:
        """
        Update exercise with authorization check
        """
        exercise = self.exercise_repository.find_by_id(exercise_id)
        if not exercise:
            raise ValueError("Exercise not found")
        
        if not exercise.can_be_modified_by(updated_by):
            raise ValueError("User is not authorized to modify this exercise")
        
        # Update exercise
        exercise.update_details(name, description, updated_by)
        
        # Save updated exercise
        return self.exercise_repository.save(exercise)
    
    def delete_exercise(self, exercise_id: uuid.UUID, deleted_by: UserId) -> None:
        """
        Delete exercise with authorization check
        """
        exercise = self.exercise_repository.find_by_id(exercise_id)
        if not exercise:
            raise ValueError("Exercise not found")
        
        if not exercise.can_be_deleted_by(deleted_by):
            raise ValueError("User is not authorized to delete this exercise")
        
        # Delete exercise
        self.exercise_repository.delete(exercise_id)
    
    def get_exercises_for_user(self, user_id: UserId) -> List[Exercise]:
        """
        Get exercises accessible to user
        """
        # For now, all users can access all exercises
        # This could be extended with more complex permission logic
        return self.exercise_repository.find_all()
    
    def get_exercises_by_creator(self, creator_id: UserId) -> List[Exercise]:
        """
        Get exercises created by specific user
        """
        return self.exercise_repository.find_by_creator(creator_id)
    
    def get_recent_exercises(self, days: int = 7) -> List[Exercise]:
        """
        Get recently created exercises
        """
        all_exercises = self.exercise_repository.find_all()
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        return [exercise for exercise in all_exercises if exercise.created_at >= cutoff_date]
    
    def can_user_create_exercise(self, user_id: UserId) -> bool:
        """
        Check if user can create exercises
        """
        # Business rule: Only staff users can create exercises
        # This would typically check user roles/permissions
        # For now, we'll assume this is checked at the application layer
        return True
    
    def get_exercise_statistics(self, exercise_id: uuid.UUID) -> dict:
        """
        Get exercise statistics
        """
        exercise = self.exercise_repository.find_by_id(exercise_id)
        if not exercise:
            raise ValueError("Exercise not found")
        
        # This would typically aggregate data from multiple sources
        # For now, return basic information
        return {
            'id': str(exercise.id),
            'name': exercise.name,
            'created_at': exercise.created_at.isoformat(),
            'updated_at': exercise.updated_at.isoformat(),
            'is_recent': exercise.is_recent(),
            'video_asset_id': str(exercise.video_asset_id)
        }
    
    def validate_exercise_data(self, name: str, description: str) -> List[str]:
        """
        Validate exercise data and return any errors
        """
        errors = []
        
        if not name or not name.strip():
            errors.append("Exercise name is required")
        elif len(name.strip()) > 255:
            errors.append("Exercise name cannot exceed 255 characters")
        
        if description and len(description) > 2000:
            errors.append("Exercise description cannot exceed 2000 characters")
        
        return errors
