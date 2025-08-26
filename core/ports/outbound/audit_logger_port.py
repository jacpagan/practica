"""
Audit logger port - Secondary port for audit logging operations
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
from datetime import datetime


class AuditLoggerPort(ABC):
    """
    Secondary port for audit logging operations
    This interface defines what the domain needs from audit logging systems
    """
    
    @abstractmethod
    def log_audit_event(self, event_type: str, user_id: str, resource_id: str, 
                       action: str, details: Dict[str, Any] = None) -> None:
        """Log audit event"""
        pass
    
    @abstractmethod
    def log_user_action(self, user_id: str, action: str, resource_type: str, 
                       resource_id: str, details: Dict[str, Any] = None) -> None:
        """Log user action"""
        pass
    
    @abstractmethod
    def log_system_event(self, event_type: str, component: str, 
                        details: Dict[str, Any] = None) -> None:
        """Log system event"""
        pass
    
    @abstractmethod
    def log_security_event(self, event_type: str, user_id: str = None, 
                          ip_address: str = None, details: Dict[str, Any] = None) -> None:
        """Log security event"""
        pass
