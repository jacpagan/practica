"""
Security components for Practika
"""

import re
import hashlib
import logging
from typing import Dict, List, Any
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


class SecurityValidator:
    """Security validation utilities"""
    
    @staticmethod
    def validate_password_strength(password: str) -> Dict[str, Any]:
        """Validate password strength and return score and feedback"""
        score = 0
        feedback = []
        
        # Length check
        if len(password) >= 8:
            score += 1
        else:
            feedback.append("Password must be at least 8 characters long")
        
        # Character variety checks
        if re.search(r'[a-z]', password):
            score += 1
        if re.search(r'[A-Z]', password):
            score += 1
        if re.search(r'\d', password):
            score += 1
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 1
        
        # Common password check
        common_passwords = {'password', '123456', 'qwerty', 'admin', 'letmein'}
        if password.lower() in common_passwords:
            feedback.append("This is a commonly used password")
            score = max(0, score - 1)
        
        # Determine if valid (score >= 3)
        valid = score >= 3
        
        return {
            'valid': valid,
            'score': score,
            'feedback': feedback
        }
    
    @staticmethod
    def sanitize_input(input_text: str, max_length: int = 1000) -> str:
        """Sanitize user input to prevent XSS and other attacks"""
        if not input_text:
            return ""
        
        # HTML escape
        sanitized = input_text.replace('&', '&amp;')
        sanitized = sanitized.replace('<', '&lt;')
        sanitized = sanitized.replace('>', '&gt;')
        sanitized = sanitized.replace('"', '&quot;')
        sanitized = sanitized.replace("'", '&#x27;')
        
        # Length truncation
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        return sanitized
    
    @staticmethod
    def validate_file_upload(filename: str, file_size: int, mime_type: str) -> Dict[str, Any]:
        """Validate file upload for security"""
        errors = []
        
        # Check file extension
        allowed_extensions = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}
        file_ext = filename.lower()[filename.rfind('.'):]
        
        if file_ext not in allowed_extensions:
            errors.append(f"File extension {file_ext} is not allowed")
        
        # Check MIME type
        allowed_mime_types = {'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'}
        if mime_type not in allowed_mime_types:
            errors.append(f"MIME type {mime_type} is not allowed")
        
        # Check file size (100MB limit)
        max_size = 100 * 1024 * 1024
        if file_size > max_size:
            errors.append(f"File size {file_size} exceeds maximum allowed size of {max_size}")
        
        # Check for suspicious filenames
        suspicious_patterns = [
            r'\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|war|ear|apk)$',
            r'(script|shell|command|exec|system|eval|function)',
            r'\.\./',  # Path traversal
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, filename, re.IGNORECASE):
                errors.append("Suspicious filename detected")
                break
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }


class SecurityAuditor:
    """Security auditing and monitoring utilities"""
    
    @staticmethod
    def log_security_event(event_type: str, event_data: Dict[str, Any], level: str = 'info'):
        """Log security events for monitoring and analysis"""
        log_message = f"Security Event: {event_type} - {event_data}"
        
        if level == 'error':
            logger.error(log_message)
        elif level == 'warning':
            logger.warning(log_message)
        else:
            logger.info(log_message)
    
    @staticmethod
    def check_suspicious_activity(request_data: Dict[str, Any]) -> List[str]:
        """Check for suspicious activity patterns in request data"""
        suspicious_patterns = []
        
        # SQL injection patterns
        sql_patterns = [
            r'(\b(union|select|insert|update|delete|drop|create|alter)\b)',
            r'(\b(or|and)\b\s+\d+\s*[=<>])',
            r'(\b(exec|execute|xp_cmdshell)\b)',
        ]
        
        # XSS patterns
        xss_patterns = [
            r'<script[^>]*>',
            r'javascript:',
            r'on\w+\s*=',
            r'<iframe[^>]*>',
        ]
        
        # Command injection patterns
        cmd_patterns = [
            r'(\b(cat|ls|dir|rm|del|wget|curl|nc|netcat)\b)',
            r'(\b(&&|\|\||;|`)\b)',
        ]
        
        # Check all patterns
        all_patterns = sql_patterns + xss_patterns + cmd_patterns
        
        for pattern in all_patterns:
            for key, value in request_data.items():
                if isinstance(value, str) and re.search(pattern, value, re.IGNORECASE):
                    suspicious_patterns.append(f"SQL/XSS/CMD pattern detected in {key}")
        
        return suspicious_patterns
