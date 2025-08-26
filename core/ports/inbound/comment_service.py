"""
Comment service port - Primary port for comment operations
"""

import uuid
from abc import ABC, abstractmethod
from typing import List

from ...domain.entities import VideoComment
from ...domain.value_objects import UserId


class CommentService(ABC):
    """
    Primary port for comment operations
    This interface defines what the domain can do with comments
    """
    
    @abstractmethod
    def add_comment(self, exercise_id: uuid.UUID, author_id: UserId, video_asset_id: uuid.UUID, text: str = None) -> VideoComment:
        """Add comment to exercise"""
        pass
    
    @abstractmethod
    def get_comment(self, comment_id: uuid.UUID, user_id: UserId) -> VideoComment:
        """Get comment by ID"""
        pass
    
    @abstractmethod
    def update_comment(self, comment_id: uuid.UUID, new_text: str, updated_by: UserId) -> VideoComment:
        """Update comment"""
        pass
    
    @abstractmethod
    def delete_comment(self, comment_id: uuid.UUID, deleted_by: UserId) -> None:
        """Delete comment"""
        pass
    
    @abstractmethod
    def list_comments_for_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> List[VideoComment]:
        """List comments for exercise"""
        pass
    
    @abstractmethod
    def list_comments_by_author(self, author_id: UserId) -> List[VideoComment]:
        """List comments by author"""
        pass
    
    @abstractmethod
    def can_user_comment_on_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> bool:
        """Check if user can comment on exercise"""
        pass
