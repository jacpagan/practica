"""
Dependency injection container for services
"""

from core.services.video_storage_service import VideoStorageService
from core.services.mime_detector import MimeTypeDetectionService
from core.services.file_validator import FileValidationService
from core.services.video_url_provider import VideoUrlProviderService
from core.registry.storage_backends import create_storage_backend


class ServiceContainer:
    """Simple dependency injection container"""
    
    _instance = None
    _services = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def get_video_storage_service(self) -> VideoStorageService:
        """Get VideoStorageService instance with injected dependencies"""
        if 'video_storage_service' not in self._services:
            self._services['video_storage_service'] = VideoStorageService()
        return self._services['video_storage_service']
    
    def get_mime_detector(self) -> MimeTypeDetectionService:
        """Get MimeTypeDetectionService instance"""
        if 'mime_detector' not in self._services:
            self._services['mime_detector'] = MimeTypeDetectionService()
        return self._services['mime_detector']
    
    def get_file_validator(self) -> FileValidationService:
        """Get FileValidationService instance"""
        if 'file_validator' not in self._services:
            self._services['file_validator'] = FileValidationService()
        return self._services['file_validator']
    
    def get_url_provider(self) -> VideoUrlProviderService:
        """Get VideoUrlProviderService instance"""
        if 'url_provider' not in self._services:
            self._services['url_provider'] = VideoUrlProviderService()
        return self._services['url_provider']


# Global service container instance
container = ServiceContainer()
