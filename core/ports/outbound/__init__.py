"""
Outbound ports - Secondary ports (driven by domain)
"""

from .video_storage_port import VideoStoragePort
from .notification_port import NotificationPort
from .audit_logger_port import AuditLoggerPort
from .repository_ports import (
    VideoAssetRepository,
    ExerciseRepository,
    CommentRepository
)

__all__ = [
    'VideoStoragePort',
    'NotificationPort',
    'AuditLoggerPort',
    'VideoAssetRepository',
    'ExerciseRepository',
    'CommentRepository'
]
