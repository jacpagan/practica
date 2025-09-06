"""
Custom CSRF middleware to exempt API endpoints from CSRF protection.
This allows the React frontend to make API calls without CSRF tokens.
"""

from django.middleware.csrf import CsrfViewMiddleware
from django.conf import settings


class CustomCsrfMiddleware(CsrfViewMiddleware):
    """
    Custom CSRF middleware that exempts API endpoints from CSRF protection.
    This is safe because:
    1. API endpoints use DRF which has its own authentication mechanisms
    2. We're using CORS headers to control cross-origin access
    3. The frontend and backend are on the same domain in production
    """
    
    def process_view(self, request, callback, callback_args, callback_kwargs):
        # Check if the path should be exempt from CSRF protection
        exempt_paths = getattr(settings, 'CSRF_EXEMPT_PATHS', [])
        for exempt_path in exempt_paths:
            if request.path.startswith(exempt_path):
                # Completely bypass CSRF for API endpoints
                return None
        
        # For all other endpoints, use normal CSRF protection
        return super().process_view(request, callback, callback_args, callback_kwargs)
    
    def process_request(self, request):
        # Additional protection: completely skip CSRF for API endpoints
        exempt_paths = getattr(settings, 'CSRF_EXEMPT_PATHS', [])
        for exempt_path in exempt_paths:
            if request.path.startswith(exempt_path):
                # Set a flag to completely bypass CSRF processing
                request._dont_enforce_csrf_checks = True
                break
        
        return super().process_request(request)
