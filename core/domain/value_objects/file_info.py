"""
File information value object
"""

import hashlib
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class FileInfo:
    """Immutable value object for file information"""
    
    original_filename: str
    mime_type: str
    size_bytes: int
    checksum_sha256: str
    
    def __post_init__(self):
        """Validate file information"""
        if not self.original_filename or not self.original_filename.strip():
            raise ValueError("Original filename cannot be empty")
        
        if not self.mime_type or not self.mime_type.strip():
            raise ValueError("MIME type cannot be empty")
        
        if self.size_bytes < 0:
            raise ValueError("File size cannot be negative")
        
        if not self.checksum_sha256 or len(self.checksum_sha256) != 64:
            raise ValueError("SHA256 checksum must be 64 characters")
    
    @classmethod
    def create_from_file(cls, file_obj, mime_type: str) -> 'FileInfo':
        """Create FileInfo from file object"""
        # Calculate checksum
        file_obj.seek(0)
        content = file_obj.read()
        checksum = hashlib.sha256(content).hexdigest()
        file_obj.seek(0)  # Reset file pointer
        
        return cls(
            original_filename=file_obj.name,
            mime_type=mime_type,
            size_bytes=len(content),
            checksum_sha256=checksum
        )
    
    @property
    def size_mb(self) -> float:
        """Get file size in MB"""
        return self.size_bytes / (1024 * 1024)
    
    @property
    def extension(self) -> str:
        """Get file extension"""
        return self.original_filename.split('.')[-1].lower() if '.' in self.original_filename else ''
    
    def is_video(self) -> bool:
        """Check if file is a video"""
        return self.mime_type.startswith('video/')
    
    def is_valid_size(self, max_size_mb: int = 100) -> bool:
        """Check if file size is within limits"""
        return self.size_mb <= max_size_mb
