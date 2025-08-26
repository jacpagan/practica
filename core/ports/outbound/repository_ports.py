"""
Repository ports - Secondary ports for data access operations
"""

import uuid
from abc import ABC, abstractmethod
from typing import List, Optional

from ...domain.entities import VideoAsset, Exercise, VideoComment
from ...domain.value_objects import UserId


class VideoAssetRepository(ABC):
    """
    Repository port for VideoAsset operations
    """
    
    @abstractmethod
    def save(self, video_asset: VideoAsset) -> VideoAsset:
        """Save video asset"""
        pass
    
    @abstractmethod
    def find_by_id(self, video_id: uuid.UUID) -> Optional[VideoAsset]:
        """Find video asset by ID"""
        pass
    
    @abstractmethod
    def find_all(self) -> List[VideoAsset]:
        """Find all video assets"""
        pass
    
    @abstractmethod
    def find_by_processing_status(self, status: str) -> List[VideoAsset]:
        """Find video assets by processing status"""
        pass
    
    @abstractmethod
    def delete(self, video_id: uuid.UUID) -> None:
        """Delete video asset"""
        pass


class ExerciseRepository(ABC):
    """
    Repository port for Exercise operations
    """
    
    @abstractmethod
    def save(self, exercise: Exercise) -> Exercise:
        """Save exercise"""
        pass
    
    @abstractmethod
    def find_by_id(self, exercise_id: uuid.UUID) -> Optional[Exercise]:
        """Find exercise by ID"""
        pass
    
    @abstractmethod
    def find_all(self) -> List[Exercise]:
        """Find all exercises"""
        pass
    
    @abstractmethod
    def find_by_creator(self, creator_id: UserId) -> List[Exercise]:
        """Find exercises by creator"""
        pass
    
    @abstractmethod
    def find_by_video_asset(self, video_asset_id: uuid.UUID) -> List[Exercise]:
        """Find exercises by video asset"""
        pass
    
    @abstractmethod
    def delete(self, exercise_id: uuid.UUID) -> None:
        """Delete exercise"""
        pass


class CommentRepository(ABC):
    """
    Repository port for VideoComment operations
    """
    
    @abstractmethod
    def save(self, comment: VideoComment) -> VideoComment:
        """Save comment"""
        pass
    
    @abstractmethod
    def find_by_id(self, comment_id: uuid.UUID) -> Optional[VideoComment]:
        """Find comment by ID"""
        pass
    
    @abstractmethod
    def find_all(self) -> List[VideoComment]:
        """Find all comments"""
        pass
    
    @abstractmethod
    def find_by_exercise(self, exercise_id: uuid.UUID) -> List[VideoComment]:
        """Find comments by exercise"""
        pass
    
    @abstractmethod
    def find_by_author(self, author_id: UserId) -> List[VideoComment]:
        """Find comments by author"""
        pass
    
    @abstractmethod
    def find_by_video_asset(self, video_asset_id: uuid.UUID) -> List[VideoComment]:
        """Find comments by video asset"""
        pass
    
    @abstractmethod
    def delete(self, comment_id: uuid.UUID) -> None:
        """Delete comment"""
        pass
