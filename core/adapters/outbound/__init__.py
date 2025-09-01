"""
Outbound adapters - Connect to external systems
"""

from .repository_adapters import (
    DjangoVideoAssetRepository,
    DjangoExerciseRepository,
    DjangoCommentRepository
)

__all__ = [
    'DjangoVideoAssetRepository',
    'DjangoExerciseRepository',
    'DjangoCommentRepository'
]
