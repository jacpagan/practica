"""
Security utilities for the Practika system
"""
import re
import hashlib
import secrets
import logging
import time
from typing import List, Dict, Any
from django.conf import settings
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class SecurityValidator:
    """Class for validating security-related inputs and configurations"""
    
    @staticmethod
    def validate_password_strength(password: str) -> Dict[str, Any]:
        """
        Validate password strength and return detailed feedback
        
        Args:
            password: Password to validate
            
        Returns:
            Dict with validation results and feedback
        """
        if not password:
            return {
                'valid': False,
                'score': 0,
                'feedback': ['Password cannot be empty']
            }
        
        feedback = []
        score = 0
        
        # Length check
        if len(password) >= 8:
            score += 1
        else:
            feedback.append('Password must be at least 8 characters long')
        
        # Character variety checks
        if re.search(r'[a-z]', password):
            score += 1
        else:
            feedback.append('Password must contain at least one lowercase letter')
        
        if re.search(r'[A-Z]', password):
            score += 1
        else:
            feedback.append('Password must contain at least one uppercase letter')
        
        if re.search(r'\d', password):
            score += 1
        else:
            feedback.append('Password must contain at least one number')
        
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 1
        else:
            feedback.append('Password must contain at least one special character')
        
        # Common password check
        common_passwords = [
            'password', '123456', '12345678', 'qwerty', 'abc123',
            'password123', 'admin', 'letmein', 'welcome', 'monkey'
        ]
        
        if password.lower() in common_passwords:
            score -= 1
            feedback.append('Password is too common')
        
        # Sequential character check
        if re.search(r'(.)\1{2,}', password):
            score -= 1
            feedback.append('Password contains too many repeated characters')
        
        # Determine validity
        min_score = getattr(settings, 'MIN_PASSWORD_SCORE', 3)
        valid = score >= min_score
        
        if valid and not feedback:
            feedback.append('Password meets all requirements')
        
        return {
            'valid': valid,
            'score': score,
            'max_score': 5,
            'feedback': feedback,
            'min_required': min_score
        }
    
    @staticmethod
    def sanitize_input(input_string: str, max_length: int = 1000) -> str:
        """
        Sanitize user input to prevent XSS and injection attacks
        
        Args:
            input_string: Input string to sanitize
            max_length: Maximum allowed length
            
        Returns:
            Sanitized string
        """
        if not input_string:
            return ''
        
        # Convert to string if needed
        input_string = str(input_string)
        
        # Truncate if too long
        if len(input_string) > max_length:
            input_string = input_string[:max_length]
            logger.warning(f"Input truncated to {max_length} characters")
        
        # Remove or escape potentially dangerous characters
        dangerous_patterns = [
            (r'<script', '&lt;script'),
            (r'javascript:', 'javascript&#58;'),
            (r'vbscript:', 'vbscript&#58;'),
            (r'onload=', 'onload&#61;'),
            (r'onerror=', 'onerror&#61;'),
            (r'onclick=', 'onclick&#61;'),
            (r'data:', 'data&#58;'),
        ]
        
        for pattern, replacement in dangerous_patterns:
            input_string = re.sub(pattern, replacement, input_string, flags=re.IGNORECASE)
        
        # Remove null bytes
        input_string = input_string.replace('\x00', '')
        
        return input_string.strip()
    
    @staticmethod
    def validate_file_upload(filename: str, file_size: int, mime_type: str = None) -> Dict[str, Any]:
        """
        Validate file upload for security
        
        Args:
            filename: Name of the uploaded file
            file_size: Size of the file in bytes
            mime_type: MIME type of the file
            
        Returns:
            Dict with validation results
        """
        errors = []
        warnings = []
        
        # Check file size
        max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 100 * 1024 * 1024)
        if file_size > max_size:
            errors.append(f"File size {file_size} exceeds maximum allowed size {max_size}")
        
        # Check file extension
        allowed_extensions = getattr(settings, 'ALLOWED_VIDEO_EXTENSIONS', ['.mp4', '.webm', '.mov', '.avi'])
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        if file_extension not in [ext.lstrip('.') for ext in allowed_extensions]:
            errors.append(f"File extension '.{file_extension}' is not allowed")
        
        # Check for suspicious filename patterns
        suspicious_patterns = [
            '..', '\\', '//', 'script', 'javascript', 'vbscript',
            'data:', 'vbscript:', 'onload', 'onerror', 'onclick'
        ]
        
        filename_lower = filename.lower()
        for pattern in suspicious_patterns:
            if pattern in filename_lower:
                warnings.append(f"Suspicious filename pattern detected: {pattern}")
        
        # Check MIME type if provided
        if mime_type:
            allowed_mime_types = getattr(settings, 'ALLOWED_VIDEO_MIME_TYPES', [])
            if mime_type not in allowed_mime_types:
                errors.append(f"MIME type '{mime_type}' is not allowed")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'file_size': file_size,
            'file_extension': file_extension,
            'mime_type': mime_type
        }
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """
        Generate a cryptographically secure token
        
        Args:
            length: Length of the token
            
        Returns:
            Secure token string
        """
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def hash_sensitive_data(data: str) -> str:
        """
        Hash sensitive data for logging or storage
        
        Args:
            data: Data to hash
            
        Returns:
            Hashed data
        """
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    @staticmethod
    def check_rate_limit(identifier: str, action: str, limit: int, period: int) -> bool:
        """
        Check if an action is rate limited
        
        Args:
            identifier: Unique identifier (IP, user, etc.)
            action: Type of action being rate limited
            limit: Maximum number of actions allowed
            period: Time period in seconds
            
        Returns:
            True if rate limited, False otherwise
        """
        from django.core.cache import cache
        
        cache_key = f"rate_limit:{action}:{identifier}"
        current_count = cache.get(cache_key, 0)
        
        if current_count >= limit:
            return True
        
        # Increment counter
        cache.set(cache_key, current_count + 1, period)
        return False


class SecurityAuditor:
    """Class for security auditing and logging"""
    
    @staticmethod
    def log_security_event(event_type: str, details: Dict[str, Any], severity: str = 'info'):
        """
        Log security events with consistent formatting
        
        Args:
            event_type: Type of security event
            details: Event details
            severity: Log severity level
        """
        log_data = {
            'event_type': event_type,
            'timestamp': time.time(),
            'severity': severity,
            'details': details
        }
        
        if severity == 'warning':
            logger.warning(f"Security event: {event_type} - {details}")
        elif severity == 'error':
            logger.error(f"Security event: {event_type} - {details}")
        else:
            logger.info(f"Security event: {event_type} - {details}")
    
    @staticmethod
    def audit_user_action(user_id: int, action: str, resource: str, details: Dict[str, Any] = None):
        """
        Audit user actions for security monitoring
        
        Args:
            user_id: ID of the user performing the action
            action: Action being performed
            resource: Resource being accessed
            details: Additional details about the action
        """
        audit_data = {
            'user_id': user_id,
            'action': action,
            'resource': resource,
            'timestamp': time.time(),
            'details': details or {}
        }
        
        logger.info(f"User action audit: {audit_data}")
    
    @staticmethod
    def check_suspicious_activity(request_data: Dict[str, Any]) -> List[str]:
        """
        Check for suspicious activity patterns in request data
        
        Args:
            request_data: Request data to analyze
            
        Returns:
            List of suspicious patterns found
        """
        suspicious_patterns = []
        
        # Check for SQL injection patterns
        sql_patterns = [
            r'union\s+select', r'drop\s+table', r'insert\s+into',
            r'delete\s+from', r'update\s+set', r'alter\s+table',
            r'exec\s*\(', r'execute\s*\(', r'xp_cmdshell'
        ]
        
        # Check for XSS patterns
        xss_patterns = [
            r'<script', r'javascript:', r'vbscript:', r'onload=',
            r'onerror=', r'onclick=', r'data:', r'vbscript:'
        ]
        
        # Check for command injection patterns
        cmd_patterns = [
            r'cmd\.exe', r'powershell', r'bash', r'sh\s+-c',
            r'rm\s+-rf', r'del\s+/s', r'format\s+c:'
        ]
        
        request_string = str(request_data).lower()
        
        for pattern in sql_patterns + xss_patterns + cmd_patterns:
            if re.search(pattern, request_string, re.IGNORECASE):
                suspicious_patterns.append(f"SQL/XSS/CMD pattern: {pattern}")
        
        return suspicious_patterns


# Convenience functions
def validate_password(password: str) -> Dict[str, Any]:
    """Validate password strength"""
    return SecurityValidator.validate_password_strength(password)


def sanitize_input(input_string: str, max_length: int = 1000) -> str:
    """Sanitize user input"""
    return SecurityValidator.sanitize_input(input_string, max_length)


def validate_file_upload(filename: str, file_size: int, mime_type: str = None) -> Dict[str, Any]:
    """Validate file upload"""
    return SecurityValidator.validate_file_upload(filename, file_size, mime_type)


def log_security_event(event_type: str, details: Dict[str, Any], severity: str = 'info'):
    """Log security event"""
    SecurityAuditor.log_security_event(event_type, details, severity)
