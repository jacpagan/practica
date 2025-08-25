"""
Core middleware for Practika platform
Simplified middleware for production stability
"""

import time
import logging
import uuid
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponse

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
        
        return response
    
    def process_exception(self, request, exception):
        if hasattr(request, 'start_time'):
            duration = (time.time() - request.start_time) * 1000
            logger.error(f"Request failed: {request.method} {request.path} - Exception: {str(exception)} ({duration:.2f}ms)")
        
        return None

class PerformanceMonitoringMiddleware(MiddlewareMixin):
    """Monitor request performance and log slow requests"""
    
    def process_request(self, request):
        request.start_time = time.time()
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'start_time'):
            duration = time.time() - request.start_time
            
            # Log slow requests
            if duration > 1.0:  # Log requests taking more than 1 second
                logger.warning(f"Slow request: {request.method} {request.path} took {duration:.2f}s")
        
        return response

class SecurityMiddleware(MiddlewareMixin):
    """Add security headers to responses"""
    
    def process_response(self, request, response):
        # Security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response

class MobileOptimizationMiddleware(MiddlewareMixin):
    """Optimize responses for mobile devices"""
    
    def process_request(self, request):
        # Detect mobile devices
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        request.is_mobile = any(device in user_agent for device in ['mobile', 'android', 'iphone', 'ipad'])
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Add mobile-specific headers
            response['Vary'] = 'User-Agent'
        
        return response

class DeviceCompatibilityMiddleware(MiddlewareMixin):
    """Ensure device compatibility"""
    
    def process_request(self, request):
        # Basic device detection
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        request.device_type = 'desktop'
        
        if 'mobile' in user_agent.lower():
            request.device_type = 'mobile'
        elif 'tablet' in user_agent.lower():
            request.device_type = 'tablet'
        
        return None

class RequestIDFilter(logging.Filter):
    """Add request ID to log records"""
    
    def filter(self, record):
        # This will be set by the middleware
        record.request_id = getattr(record, 'request_id', 'no-request-id')
        return True
