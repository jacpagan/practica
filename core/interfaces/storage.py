"""
Storage backend interfaces following SOLID principles
"""

from abc import ABC, abstractmethod
from typing import Optional


class StorageBackend(ABC):
    """Abstract base class for storage backends"""
    
    @abstractmethod
    def upload(self, file_obj, filename: str) -> str:
        """Upload file to storage backend"""
        pass
    
    @abstractmethod
    def get_url(self, storage_path: str) -> str:
        """Get public URL for stored file"""
        pass
    
    @abstractmethod
    def delete(self, storage_path: str) -> bool:
        """Delete file from storage backend"""
        pass
    
    @abstractmethod
    def exists(self, storage_path: str) -> bool:
        """Check if file exists in storage"""
        pass


class VideoUrlProvider(ABC):
    """Interface for video URL generation"""
    
    @abstractmethod
    def get_video_url(self, video_asset) -> str:
        """Get public URL for video asset"""
        pass


class MimeTypeDetector(ABC):
    """Interface for MIME type detection"""
    
    @abstractmethod
    def detect_mime_type(self, file_obj) -> str:
        """Detect MIME type of file"""
        pass


class FileValidator(ABC):
    """Interface for file validation"""
    
    @abstractmethod
    def validate_file(self, file_obj) -> tuple[bool, Optional[str]]:
        """Validate file and return (is_valid, error_message)"""
        pass
