"""
Video service port - Primary port for video operations
"""

import uuid
from abc import ABC, abstractmethod
from typing import List

from ...domain.entities import VideoAsset
from ...domain.value_objects import FileInfo, VideoMetadata


class VideoService(ABC):
    """
    Primary port for video operations
    This interface defines what the domain can do with videos
    """
    
    @abstractmethod
    def upload_video(self, file_info: FileInfo, storage_path: str) -> VideoAsset:
        """Upload video and create VideoAsset"""
        pass
    
    @abstractmethod
    def get_video(self, video_id: uuid.UUID) -> VideoAsset:
        """Get video by ID"""
        pass
    
    @abstractmethod
    def start_processing(self, video_id: uuid.UUID) -> str:
        """Start video processing"""
        pass
    
    @abstractmethod
    def complete_processing(self, video_id: uuid.UUID, video_metadata: VideoMetadata, poster_path: str) -> None:
        """Complete video processing"""
        pass
    
    @abstractmethod
    def fail_processing(self, video_id: uuid.UUID, error_message: str, error_code: str = None) -> None:
        """Fail video processing"""
        pass
    
    @abstractmethod
    def get_video_url(self, video_id: uuid.UUID) -> str:
        """Get public URL for video"""
        pass
    
    @abstractmethod
    def delete_video(self, video_id: uuid.UUID) -> None:
        """Delete video"""
        pass
    
    @abstractmethod
    def validate_video(self, video_id: uuid.UUID) -> None:
        """Validate video file"""
        pass
    
    @abstractmethod
    def list_videos(self) -> List[VideoAsset]:
        """List all videos"""
        pass
