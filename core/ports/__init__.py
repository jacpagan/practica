"""
Ports - Interfaces for external interactions
"""

from .inbound import (
    ExerciseService,
    VideoService,
    CommentService
)

from .outbound import (
    VideoStoragePort,
    NotificationPort,
    AuditLoggerPort,
    RepositoryPorts
)

__all__ = [
    # Inbound ports
    'ExerciseService',
    'VideoService', 
    'CommentService',
    
    # Outbound ports
    'VideoStoragePort',
    'NotificationPort',
    'AuditLoggerPort',
    'RepositoryPorts'
]
