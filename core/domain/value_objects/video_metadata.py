"""
Video metadata value object
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class VideoMetadata:
    """Immutable value object for video metadata"""
    
    duration_sec: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    frame_rate: Optional[float] = None
    bitrate: Optional[int] = None
    
    def __post_init__(self):
        """Validate video metadata"""
        if self.duration_sec is not None and self.duration_sec < 0:
            raise ValueError("Duration must be non-negative")
        
        if self.width is not None and self.width <= 0:
            raise ValueError("Width must be positive")
        
        if self.height is not None and self.height <= 0:
            raise ValueError("Height must be positive")
        
        if self.frame_rate is not None and self.frame_rate <= 0:
            raise ValueError("Frame rate must be positive")
        
        if self.bitrate is not None and self.bitrate <= 0:
            raise ValueError("Bitrate must be positive")
    
    @property
    def aspect_ratio(self) -> Optional[float]:
        """Calculate aspect ratio"""
        if self.width and self.height:
            return self.width / self.height
        return None
    
    @property
    def resolution(self) -> Optional[str]:
        """Get resolution string"""
        if self.width and self.height:
            return f"{self.width}x{self.height}"
        return None
    
    def is_hd(self) -> bool:
        """Check if video is HD quality"""
        return self.width and self.height and (self.width >= 1280 or self.height >= 720)
    
    def is_4k(self) -> bool:
        """Check if video is 4K quality"""
        return self.width and self.height and (self.width >= 3840 or self.height >= 2160)
