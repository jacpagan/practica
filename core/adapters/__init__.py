"""
Adapters - Implementations that connect to external systems
"""

from .inbound import (
    WebExerciseController,
    APIExerciseController,
    WebVideoController,
    APIVideoController,
    WebCommentController,
    APICommentController
)

from .outbound import (
    DjangoVideoStorageAdapter,
    S3VideoStorageAdapter,
    EmailNotificationAdapter,
    WebhookNotificationAdapter,
    DjangoAuditLoggerAdapter,
    DjangoRepositoryAdapters
)

__all__ = [
    # Inbound adapters
    'WebExerciseController',
    'APIExerciseController',
    'WebVideoController',
    'APIVideoController',
    'WebCommentController',
    'APICommentController',
    
    # Outbound adapters
    'DjangoVideoStorageAdapter',
    'S3VideoStorageAdapter',
    'EmailNotificationAdapter',
    'WebhookNotificationAdapter',
    'DjangoAuditLoggerAdapter',
    'DjangoRepositoryAdapters'
]
