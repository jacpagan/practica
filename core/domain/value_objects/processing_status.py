"""
Processing status value object
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional


class ProcessingState(Enum):
    """Processing state enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class ProcessingStatus:
    """Immutable value object for processing status"""
    
    state: ProcessingState
    error_message: Optional[str] = None
    progress_percentage: Optional[int] = None
    
    def __post_init__(self):
        """Validate processing status"""
        if self.progress_percentage is not None:
            if not 0 <= self.progress_percentage <= 100:
                raise ValueError("Progress percentage must be between 0 and 100")
        
        if self.state == ProcessingState.FAILED and not self.error_message:
            raise ValueError("Failed state must have an error message")
        
        if self.state != ProcessingState.FAILED and self.error_message:
            raise ValueError("Only failed state can have an error message")
    
    @classmethod
    def pending(cls) -> 'ProcessingStatus':
        """Create pending status"""
        return cls(state=ProcessingState.PENDING)
    
    @classmethod
    def processing(cls, progress: int = 0) -> 'ProcessingStatus':
        """Create processing status with progress"""
        return cls(state=ProcessingState.PROCESSING, progress_percentage=progress)
    
    @classmethod
    def completed(cls) -> 'ProcessingStatus':
        """Create completed status"""
        return cls(state=ProcessingState.COMPLETED, progress_percentage=100)
    
    @classmethod
    def failed(cls, error_message: str) -> 'ProcessingStatus':
        """Create failed status with error"""
        return cls(state=ProcessingState.FAILED, error_message=error_message)
    
    def is_pending(self) -> bool:
        """Check if status is pending"""
        return self.state == ProcessingState.PENDING
    
    def is_processing(self) -> bool:
        """Check if status is processing"""
        return self.state == ProcessingState.PROCESSING
    
    def is_completed(self) -> bool:
        """Check if status is completed"""
        return self.state == ProcessingState.COMPLETED
    
    def is_failed(self) -> bool:
        """Check if status is failed"""
        return self.state == ProcessingState.FAILED
    
    def can_transition_to(self, new_state: ProcessingState) -> bool:
        """Check if transition to new state is valid"""
        valid_transitions = {
            ProcessingState.PENDING: [ProcessingState.PROCESSING, ProcessingState.FAILED],
            ProcessingState.PROCESSING: [ProcessingState.COMPLETED, ProcessingState.FAILED],
            ProcessingState.COMPLETED: [],  # Terminal state
            ProcessingState.FAILED: [ProcessingState.PENDING]  # Can retry
        }
        return new_state in valid_transitions.get(self.state, [])
