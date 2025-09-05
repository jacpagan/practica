"""
Custom CSRF middleware to exempt API endpoints from CSRF protection.
This allows the React frontend to make API calls without CSRF tokens.
"""

from django.middleware.csrf import CsrfViewMiddleware


class CustomCsrfMiddleware(CsrfViewMiddleware):
    """
    Custom CSRF middleware that exempts API endpoints from CSRF protection.
    This is safe because:
    1. API endpoints use DRF which has its own authentication mechanisms
    2. We're using CORS headers to control cross-origin access
    3. The frontend and backend are on the same domain in production
    """
    
    def process_view(self, request, callback, callback_args, callback_kwargs):
        # Exempt API endpoints from CSRF protection
        if request.path.startswith('/api/'):
            return None
        
        # Exempt health check endpoint
        if request.path.startswith('/health/'):
            return None
            
        # For all other endpoints, use normal CSRF protection
        return super().process_view(request, callback, callback_args, callback_kwargs)
