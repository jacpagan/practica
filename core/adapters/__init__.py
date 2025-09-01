"""
Adapters - Implementations that connect to external systems
"""

from .outbound import (
    DjangoVideoAssetRepository,
    DjangoExerciseRepository,
    DjangoCommentRepository
)

__all__ = [
    # Outbound adapters
    'DjangoVideoAssetRepository',
    'DjangoExerciseRepository',
    'DjangoCommentRepository'
]
