"""
Base domain event
"""

import uuid
from abc import ABC
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any


@dataclass
class DomainEvent(ABC):
    """Base class for all domain events"""
    
    event_id: uuid.UUID
    occurred_at: datetime
    event_type: str
    aggregate_id: uuid.UUID
    version: int = 1
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        """Initialize default values"""
        if self.metadata is None:
            self.metadata = {}
    
    @classmethod
    def create(cls, aggregate_id: uuid.UUID, **kwargs) -> 'DomainEvent':
        """Create a new domain event"""
        return cls(
            event_id=uuid.uuid4(),
            occurred_at=datetime.utcnow(),
            event_type=cls.__name__,
            aggregate_id=aggregate_id,
            **kwargs
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary"""
        return {
            'event_id': str(self.event_id),
            'occurred_at': self.occurred_at.isoformat(),
            'event_type': self.event_type,
            'aggregate_id': str(self.aggregate_id),
            'version': self.version,
            'metadata': self.metadata
        }
