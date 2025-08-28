"""
Rate limiting middleware for security and abuse prevention
"""
import time
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class RateLimitingMiddleware:
    """
    Rate limiting middleware to prevent abuse
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Skip rate limiting for admin and static files
        if request.path.startswith('/admin/') or request.path.startswith('/static/'):
            return self.get_response(request)
            
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Check rate limits
        if not self._check_rate_limit(request, client_id):
            return self._rate_limit_response(request)
            
        response = self.get_response(request)
        return response
        
    def _get_client_id(self, request):
        """Get unique client identifier"""
        # Use IP address as primary identifier
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
            
        # Add user agent for additional uniqueness
        user_agent = request.META.get('HTTP_USER_AGENT', 'unknown')[:50]
        
        return f"{ip}:{user_agent}"
        
    def _check_rate_limit(self, request, client_id):
        """Check if client is within rate limits"""
        path = request.path
        method = request.method
        
        # Different limits for different endpoints
        limits = {
            '/exercises/login/': {'POST': 5, 'GET': 20},  # Login attempts
            '/accounts/signup/': {'POST': 3, 'GET': 10},  # Signup attempts
            '/accounts/resend-verification/': {'POST': 3, 'GET': 5},  # Resend verification
            'default': {'POST': 10, 'GET': 30}  # Default limits
        }
        
        # Get limits for this endpoint
        endpoint_limits = limits.get(path, limits['default'])
        limit = endpoint_limits.get(method, endpoint_limits.get('default', 10))
        
        # Create rate limit key
        key = f"rate_limit:{client_id}:{path}:{method}:{int(time.time() // 60)}"
        
        # Check current count
        current_count = cache.get(key, 0)
        
        if current_count >= limit:
            logger.warning(f"Rate limit exceeded for {client_id} on {path} {method}")
            return False
            
        # Increment count
        cache.set(key, current_count + 1, 60)  # 1 minute window
        return True
        
    def _rate_limit_response(self, request):
        """Return rate limit response"""
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'error': 'Rate Limit Exceeded',
                'message': 'Too many requests. Please wait a moment and try again.',
                'retry_after': 60
            }, status=429)
        else:
            return HttpResponse(
                'Too many requests. Please wait a moment and try again.',
                status=429,
                content_type='text/plain'
            )
