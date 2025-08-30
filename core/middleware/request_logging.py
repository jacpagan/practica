"""
Request Logging Middleware for Practika
Generates unique request IDs and adds them to response headers
"""

import uuid
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware that generates a unique request ID for each request
    and adds it to the response headers for tracking and debugging.
    """
    
    def process_request(self, request):
        """Generate a unique request ID for each request."""
        request.request_id = str(uuid.uuid4())
        logger.info(f"Request started: {request.request_id} - {request.method} {request.path}")
        return None
    
    def process_response(self, request, response):
        """Add request ID to response headers."""
        if hasattr(request, 'request_id'):
            response['X-Request-ID'] = request.request_id
            logger.info(f"Request completed: {request.request_id} - {response.status_code}")
        return response
    
    def process_exception(self, request, exception):
        """Log exceptions with request ID."""
        if hasattr(request, 'request_id'):
            logger.error(f"Request failed: {request.request_id} - {exception}")
        return None
