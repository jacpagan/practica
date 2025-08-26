"""
Add comment command
"""

import uuid
from dataclasses import dataclass
from typing import Optional

from ...domain.value_objects import UserId


@dataclass
class AddCommentCommand:
    """Command to add a comment to an exercise"""
    
    exercise_id: uuid.UUID
    author_id: UserId
    video_file: any  # Django uploaded file
    text: Optional[str] = None
    
    def __post_init__(self):
        """Validate command data"""
        if not self.video_file:
            raise ValueError("Video file is required for comments")
        
        if not hasattr(self.video_file, 'content_type'):
            raise ValueError("Invalid video file")
        
        if not self.video_file.content_type.startswith('video/'):
            raise ValueError("File must be a video")
        
        if self.text and len(self.text) > 1000:
            raise ValueError("Comment text cannot exceed 1000 characters")
