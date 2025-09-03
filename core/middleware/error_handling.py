"""
Enhanced error handling middleware for better user experience
"""
import logging
import json
from django.http import JsonResponse, HttpResponse
from django.core.exceptions import ValidationError, PermissionDenied
from django.http import Http404
from django.conf import settings
import traceback

logger = logging.getLogger(__name__)


class EnhancedErrorHandlingMiddleware:
    """
    Middleware to provide better error handling and user feedback
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        response = self.get_response(request)
        return response
        
    def process_exception(self, request, exception):
        """
        Handle exceptions and provide user-friendly error messages
        """
        # Log the error for debugging
        logger.error(f"Exception in {request.path}: {str(exception)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Handle different types of exceptions
        if isinstance(exception, ValidationError):
            return self._handle_validation_error(request, exception)
        elif isinstance(exception, PermissionDenied):
            return self._handle_permission_error(request, exception)
        elif isinstance(exception, Http404):
            return self._handle_not_found(request, exception)
        elif isinstance(exception, Exception):
            return self._handle_generic_error(request, exception)
            
        return None
        
    def _handle_validation_error(self, request, exception):
        """Handle validation errors with user-friendly messages"""
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # AJAX request - return JSON
            return JsonResponse({
                'error': 'Validation Error',
                'message': 'Please check your input and try again.',
                'details': str(exception),
                'type': 'validation_error'
            }, status=400)
        else:
            # Regular request - redirect with message
            from django.contrib import messages
            messages.error(request, f'Please check your input: {str(exception)}')
            return None
            
    def _handle_permission_error(self, request, exception):
        """Handle permission errors"""
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'error': 'Access Denied',
                'message': 'You do not have permission to perform this action.',
                'type': 'permission_error'
            }, status=403)
        else:
            from django.contrib import messages
            messages.error(request, 'You do not have permission to perform this action.')
            return None
            
    def _handle_not_found(self, request, exception):
        """Handle 404 errors"""
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'error': 'Not Found',
                'message': 'The requested resource was not found.',
                'type': 'not_found'
            }, status=404)
        else:
            return None
            
    def _handle_generic_error(self, request, exception):
        """Handle generic errors"""
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'error': 'Server Error',
                'message': 'Something went wrong. Please try again later.',
                'type': 'server_error'
            }, status=500)
        else:
            from django.contrib import messages
            messages.error(request, 'Something went wrong. Please try again later.')
            return None
