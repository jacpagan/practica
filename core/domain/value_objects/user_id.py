"""
User ID value object
"""

import uuid
from dataclasses import dataclass
from typing import Union


@dataclass(frozen=True)
class UserId:
    """Immutable value object for user identification"""
    
    value: uuid.UUID
    
    def __post_init__(self):
        """Validate user ID"""
        if not isinstance(self.value, uuid.UUID):
            raise ValueError("User ID must be a valid UUID")
    
    @classmethod
    def generate(cls) -> 'UserId':
        """Generate a new user ID"""
        return cls(value=uuid.uuid4())
    
    @classmethod
    def from_string(cls, user_id_str: str) -> 'UserId':
        """Create UserId from string"""
        try:
            return cls(value=uuid.UUID(user_id_str))
        except ValueError:
            raise ValueError(f"Invalid UUID string: {user_id_str}")
    
    @classmethod
    def from_uuid(cls, user_uuid: uuid.UUID) -> 'UserId':
        """Create UserId from UUID"""
        return cls(value=user_uuid)
    
    def __str__(self) -> str:
        """String representation"""
        return str(self.value)
    
    def __eq__(self, other) -> bool:
        """Equality comparison"""
        if isinstance(other, UserId):
            return self.value == other.value
        return False
    
    def __hash__(self) -> int:
        """Hash for use in sets and dictionaries"""
        return hash(self.value)
