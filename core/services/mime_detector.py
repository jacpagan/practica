"""
MIME type detection service - Single Responsibility
"""

import os
import logging
from typing import Optional
from core.interfaces.storage import MimeTypeDetector

logger = logging.getLogger(__name__)


class MimeTypeDetectionService(MimeTypeDetector):
    """Service responsible only for MIME type detection"""
    
    def __init__(self):
        self._mime_types = {
            '.mp4': 'video/mp4',
            '.avi': 'video/avi',
            '.mov': 'video/mov',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.txt': 'text/plain',  # Allow text files for testing
            '.mpg': 'video/mpeg',
            '.mpeg': 'video/mpeg',
            '.mkv': 'video/x-matroska',
        }
    
    def detect_mime_type(self, file_obj) -> str:
        """Detect MIME type of file using multiple methods"""
        # Method 1: Try python-magic if available
        mime_type = self._detect_with_magic(file_obj)
        if mime_type:
            return mime_type
        
        # Method 2: Use file's content_type attribute
        mime_type = getattr(file_obj, 'content_type', None)
        if mime_type:
            return mime_type
        
        # Method 3: Use file extension
        filename = getattr(file_obj, 'name', '')
        extension = os.path.splitext(filename)[1]
        return self._get_mime_type_from_extension(extension)
    
    def _detect_with_magic(self, file_obj) -> Optional[str]:
        """Detect MIME type using python-magic library"""
        try:
            import magic
            content = file_obj.read(1024)
            file_obj.seek(0)
            if content:
                mime_type = magic.from_buffer(content, mime=True)
                logger.info(f"Detected MIME type with magic: {mime_type}")
                return mime_type
        except ImportError:
            logger.debug("python-magic not available")
        except Exception as e:
            logger.warning(f"MIME detection with magic failed: {e}")
        return None
    
    def _get_mime_type_from_extension(self, extension: str) -> str:
        """Get MIME type from file extension"""
        return self._mime_types.get(extension.lower(), 'application/octet-stream')
