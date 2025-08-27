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
        
        if any(device in user_agent for device in ['mobile', 'android', 'iphone', 'ipad']):
            request.device_type = 'mobile'
            request.is_mobile = True
        elif 'tablet' in user_agent:
            request.device_type = 'tablet'
            request.is_mobile = False
        else:
            request.device_type = 'desktop'
            request.is_mobile = False
        
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Add mobile-specific headers
            response['Vary'] = 'User-Agent'
        
        return response


# Backwards compatibility alias for tests expecting MobileOptimizationMiddleware
class MobileOptimizationMiddleware(DeviceOptimizationMiddleware):
    pass

class RequestIDFilter(logging.Filter):
    """Add request ID to log records"""
    
    def filter(self, record):
        # This will be set by the middleware
        record.request_id = getattr(record, 'request_id', 'no-request-id')
        return True
