"""
Get exercise query
"""

import uuid
from dataclasses import dataclass

from ...domain.value_objects import UserId


@dataclass
class GetExerciseQuery:
    """Query to get an exercise by ID"""
    
    exercise_id: uuid.UUID
    user_id: UserId
    
    def __post_init__(self):
        """Validate query data"""
        if not self.exercise_id:
            raise ValueError("Exercise ID is required")
        
        if not self.user_id:
            raise ValueError("User ID is required")
