"""
Get comments query
"""

import uuid
from dataclasses import dataclass
from typing import Optional

from ...domain.value_objects import UserId


@dataclass
class GetCommentsQuery:
    """Query to get comments"""
    
    user_id: UserId
    exercise_id: Optional[uuid.UUID] = None
    author_id: Optional[UserId] = None
    
    def __post_init__(self):
        """Validate query data"""
        if not self.user_id:
            raise ValueError("User ID is required")
        
        if not self.exercise_id and not self.author_id:
            raise ValueError("Either exercise_id or author_id must be provided")
