"""
Upload video command
"""

from dataclasses import dataclass


@dataclass
class UploadVideoCommand:
    """Command to upload a video"""
    
    video_file: any  # Django uploaded file
    
    def __post_init__(self):
        """Validate command data"""
        if not self.video_file:
            raise ValueError("Video file is required")
        
        if not hasattr(self.video_file, 'content_type'):
            raise ValueError("Invalid video file")
        
        if not self.video_file.content_type.startswith('video/'):
            raise ValueError("File must be a video")
