"""
File validation service - Single Responsibility
"""

import logging
from typing import Tuple, Optional
from django.conf import settings
from core.interfaces.storage import FileValidator

logger = logging.getLogger(__name__)


class FileValidationService(FileValidator):
    """Service responsible only for file validation"""
    
    def __init__(self):
        self.allowed_mime_types = getattr(settings, 'ALLOWED_VIDEO_MIME_TYPES', [])
        self.max_file_size = getattr(settings, 'MAX_VIDEO_FILE_SIZE', 100 * 1024 * 1024)  # 100MB default
    
    def validate_file(self, file_obj) -> Tuple[bool, Optional[str]]:
        """Validate file and return (is_valid, error_message)"""
        # Check file size
        if hasattr(file_obj, 'size') and file_obj.size > self.max_file_size:
            return False, f"File size ({file_obj.size} bytes) exceeds maximum allowed size ({self.max_file_size} bytes)"
        
        # Check MIME type
        mime_type = getattr(file_obj, 'content_type', None)
        if mime_type and self.allowed_mime_types and mime_type not in self.allowed_mime_types:
            return False, f"Unsupported MIME type: {mime_type}. Allowed types: {self.allowed_mime_types}"
        
        # Check if file has content
        if hasattr(file_obj, 'size') and file_obj.size <= 0:
            return False, "File is empty"
        
        return True, None
    
    def validate_mime_type(self, mime_type: str) -> Tuple[bool, Optional[str]]:
        """Validate MIME type specifically"""
        if self.allowed_mime_types and mime_type not in self.allowed_mime_types:
            return False, f"Unsupported MIME type: {mime_type}. Allowed types: {self.allowed_mime_types}"
        return True, None
