"""
Application layer - Orchestrates domain operations
"""

from .services import (
    ExerciseApplicationService,
    VideoApplicationService,
    CommentApplicationService
)

from .commands import (
    CreateExerciseCommand,
    UploadVideoCommand,
    AddCommentCommand
)

from .queries import (
    GetExerciseQuery,
    ListExercisesQuery,
    GetCommentsQuery
)

__all__ = [
    # Application Services
    'ExerciseApplicationService',
    'VideoApplicationService',
    'CommentApplicationService',
    
    # Commands
    'CreateExerciseCommand',
    'UploadVideoCommand',
    'AddCommentCommand',
    
    # Queries
    'GetExerciseQuery',
    'ListExercisesQuery',
    'GetCommentsQuery'
]
