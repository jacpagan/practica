"""
Core middleware for Practika platform
Simplified middleware for production stability
"""

import time
import logging
import uuid
from django.utils.deprecation import MiddlewareMixin


logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(MiddlewareMixin):
    """Log all requests for debugging and monitoring"""
    
    def process_request(self, request):
        request.start_time = time.time()
        request.request_id = str(uuid.uuid4())
        
        # Log request
        logger.info(f"Request started: {request.method} {request.path} (ID: {request.request_id})")
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            duration = (time.time() - request.start_time) * 1000
            logger.info(f"Request completed: {request.method} {request.path} - {response.status_code} ({duration:.2f}ms)")
            
            # Log slow requests
            if duration > 1000:  # Log requests taking more than 1 second
                logger.warning(f"Slow request: {request.method} {request.path} took {duration:.2f}ms")
        
        return response
    
    def process_exception(self, request, exception):
        if hasattr(request, 'start_time'):
            duration = (time.time() - request.start_time) * 1000
            logger.error(f"Request failed: {request.method} {request.path} - Exception: {str(exception)} ({duration:.2f}ms)")
        
        return None



class SecurityMiddleware(MiddlewareMixin):
    """Add security headers to responses"""
    
    def process_response(self, request, response):
        # Security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response

class DeviceOptimizationMiddleware(MiddlewareMixin):
    """Optimize responses for different device types"""
    
    def process_request(self, request):
        # Detect device type
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        
        # Initialize mobile settings
        request.mobile_settings = {}
        
        # Detect specific device types
        if 'android' in user_agent:
            request.device_type = 'android'
            request.is_mobile = True
            request.mobile_settings['platform'] = 'android'
            request.mobile_settings['version'] = self.extract_android_version(user_agent)
        elif 'iphone' in user_agent:
            request.device_type = 'iphone'
            request.is_mobile = True
            request.mobile_settings['platform'] = 'ios'
            request.mobile_settings['version'] = self.extract_ios_version(user_agent)
        elif 'ipad' in user_agent:
            request.device_type = 'ipad'
            request.is_mobile = True
            request.mobile_settings['platform'] = 'ios'
            request.mobile_settings['version'] = self.extract_ios_version(user_agent)
        elif any(device in user_agent for device in ['mobile', 'tablet']):
            request.device_type = 'mobile'
            request.is_mobile = True
        else:
            request.device_type = 'desktop'
            request.is_mobile = False
        
        # Detect small screen devices
        request.is_small_screen = request.is_mobile
        
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Add mobile-specific headers
            response['Vary'] = 'User-Agent'
            response['X-Mobile-Optimized'] = 'true'
            response['X-Device-Type'] = getattr(request, 'device_type', 'mobile')
            
            # Add legacy iOS header for old devices
            if hasattr(request, 'mobile_settings') and request.mobile_settings.get('platform') == 'ios':
                version = request.mobile_settings.get('version', '0')
                if version and float(version.split('.')[0]) < 12:
                    response['X-Legacy-iOS'] = 'true'
        
        return response
    
    def extract_android_version(self, user_agent):
        """Extract Android version from user agent"""
        import re
        match = re.search(r'android\s+(\d+(?:\.\d+)*)', user_agent, re.IGNORECASE)
        return match.group(1) if match else None
    
    def extract_ios_version(self, user_agent):
        """Extract iOS version from user agent"""
        import re
        match = re.search(r'os\s+(\d+(?:_\d+)*)', user_agent, re.IGNORECASE)
        if match:
            return match.group(1).replace('_', '.')
        return None
    
    def process_exception(self, request, exception):
        """Handle exceptions for mobile devices"""
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Log mobile-specific errors
            logger.error(f"Mobile error: {exception} for device {getattr(request, 'device_type', 'unknown')}")
        return None


# Backwards compatibility alias for tests expecting MobileOptimizationMiddleware
class MobileOptimizationMiddleware(DeviceOptimizationMiddleware):
    pass

class RequestIDFilter(logging.Filter):
    """Add request ID to log records"""
    
    def filter(self, record):
        # This will be set by the middleware
        record.request_id = getattr(record, 'request_id', 'no-request-id')
        return True
