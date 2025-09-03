"""
Notification port - Secondary port for notification operations
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class NotificationPort(ABC):
    """
    Secondary port for notification operations
    This interface defines what the domain needs from notification systems
    """
    
    @abstractmethod
    def send_notification(self, recipient: str, message: str, notification_type: str = "info") -> bool:
        """Send notification to recipient"""
        pass
    
    @abstractmethod
    def send_email(self, to_email: str, subject: str, body: str) -> bool:
        """Send email notification"""
        pass
    
    @abstractmethod
    def send_webhook(self, url: str, payload: Dict[str, Any]) -> bool:
        """Send webhook notification"""
        pass
    
    @abstractmethod
    def log_event(self, event_type: str, event_data: Dict[str, Any]) -> None:
        """Log event for monitoring/analytics"""
        pass
