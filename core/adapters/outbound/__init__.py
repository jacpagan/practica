"""
Outbound adapters - Connect to external systems
"""

from .video_storage_adapters import DjangoVideoStorageAdapter, S3VideoStorageAdapter
from .notification_adapters import EmailNotificationAdapter, WebhookNotificationAdapter
from .audit_logger_adapters import DjangoAuditLoggerAdapter
from .repository_adapters import (
    DjangoVideoAssetRepository,
    DjangoExerciseRepository,
    DjangoCommentRepository
)

__all__ = [
    'DjangoVideoStorageAdapter',
    'S3VideoStorageAdapter',
    'EmailNotificationAdapter',
    'WebhookNotificationAdapter',
    'DjangoAuditLoggerAdapter',
    'DjangoVideoAssetRepository',
    'DjangoExerciseRepository',
    'DjangoCommentRepository'
]
