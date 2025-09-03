"""
Inbound ports - Primary ports (driven by domain)
"""

from .exercise_service import ExerciseService
from .video_service import VideoService
from .comment_service import CommentService

__all__ = [
    'ExerciseService',
    'VideoService',
    'CommentService'
]
