"""
Exercise service port - Primary port for exercise operations
"""

import uuid
from abc import ABC, abstractmethod
from typing import List

from ...domain.entities import Exercise
from ...domain.value_objects import UserId


class ExerciseService(ABC):
    """
    Primary port for exercise operations
    This interface defines what the domain can do with exercises
    """
    
    @abstractmethod
    def create_exercise(self, name: str, description: str, video_asset_id: uuid.UUID, created_by: UserId) -> Exercise:
        """Create new exercise"""
        pass
    
    @abstractmethod
    def get_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> Exercise:
        """Get exercise by ID"""
        pass
    
    @abstractmethod
    def update_exercise(self, exercise_id: uuid.UUID, name: str = None, description: str = None, updated_by: UserId = None) -> Exercise:
        """Update exercise"""
        pass
    
    @abstractmethod
    def delete_exercise(self, exercise_id: uuid.UUID, deleted_by: UserId) -> None:
        """Delete exercise"""
        pass
    
    @abstractmethod
    def list_exercises(self, user_id: UserId) -> List[Exercise]:
        """List exercises accessible to user"""
        pass
    
    @abstractmethod
    def list_exercises_by_creator(self, creator_id: UserId) -> List[Exercise]:
        """List exercises created by user"""
        pass
    
    @abstractmethod
    def can_user_create_exercise(self, user_id: UserId) -> bool:
        """Check if user can create exercises"""
        pass
