"""
Video storage port - Secondary port for video storage operations
"""

from abc import ABC, abstractmethod
from typing import Protocol


class VideoStoragePort(ABC):
    """
    Secondary port for video storage operations
    This interface defines what the domain needs from storage systems
    """
    
    @abstractmethod
    def store_video(self, file_obj, filename: str) -> str:
        """Store video file and return storage path"""
        pass
    
    @abstractmethod
    def get_video_url(self, storage_path: str) -> str:
        """Get public URL for stored video"""
        pass
    
    @abstractmethod
    def delete_video(self, storage_path: str) -> bool:
        """Delete video file"""
        pass
    
    @abstractmethod
    def video_exists(self, storage_path: str) -> bool:
        """Check if video file exists"""
        pass
    
    @abstractmethod
    def get_video_size(self, storage_path: str) -> int:
        """Get video file size in bytes"""
        pass
