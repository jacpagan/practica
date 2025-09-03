"""
List exercises query
"""

from dataclasses import dataclass
from typing import Optional

from ...domain.value_objects import UserId


@dataclass
class ListExercisesQuery:
    """Query to list exercises"""
    
    user_id: UserId
    creator_id: Optional[UserId] = None
    
    def __post_init__(self):
        """Validate query data"""
        if not self.user_id:
            raise ValueError("User ID is required")
