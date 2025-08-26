"""
Storage backend implementations
"""

from .local_storage import LocalStorageBackend
from .s3_storage import S3StorageBackend
from core.registry.storage_backends import StorageBackendRegistry

# Register backends
StorageBackendRegistry.register('local', LocalStorageBackend)
StorageBackendRegistry.register('s3', S3StorageBackend)
