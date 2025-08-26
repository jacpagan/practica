"""
Create exercise command
"""

import uuid
from dataclasses import dataclass
from typing import Optional

from ...domain.value_objects import UserId


@dataclass
class CreateExerciseCommand:
    """Command to create a new exercise"""
    
    name: str
    description: str
    video_file: any  # Django uploaded file
    created_by: UserId
    
    def __post_init__(self):
        """Validate command data"""
        if not self.name or not self.name.strip():
            raise ValueError("Exercise name is required")
        
        if not self.video_file:
            raise ValueError("Video file is required")
        
        if len(self.name.strip()) > 255:
            raise ValueError("Exercise name cannot exceed 255 characters")
        
        if self.description and len(self.description) > 2000:
            raise ValueError("Exercise description cannot exceed 2000 characters")
