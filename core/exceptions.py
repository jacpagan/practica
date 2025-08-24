import logging
import traceback
from django.http import JsonResponse
from django.core.exceptions import ValidationError, PermissionDenied
from django.http import Http404
from django.db import IntegrityError, DatabaseError
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from django.conf import settings

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler for comprehensive error reporting and logging
    """
    
    # Log the exception with full context
    _log_exception(exc, context)
    
    # Handle Django REST Framework exceptions first
    response = drf_exception_handler(exc, context)
    if response is not None:
        return _enhance_response(response, exc, context)
    
    # Handle Django-specific exceptions
    if isinstance(exc, Http404):
        return _handle_404(exc, context)
    elif isinstance(exc, PermissionDenied):
        return _handle_permission_denied(exc, context)
    elif isinstance(exc, ValidationError):
        return _handle_validation_error(exc, context)
    elif isinstance(exc, IntegrityError):
        return _handle_integrity_error(exc, context)
    elif isinstance(exc, DatabaseError):
        return _handle_database_error(exc, context)
    
    # Handle any other unexpected exceptions
    return _handle_unexpected_exception(exc, context)


def _log_exception(exc, context):
    """Log exception with comprehensive context information"""
    
    # Extract context information
    view = context.get('view')
    request = context.get('request')
    
    log_data = {
        'exception_type': type(exc).__name__,
        'exception_message': str(exc),
        'view_name': getattr(view, '__class__.__name__', 'Unknown'),
        'view_method': getattr(view, 'action', 'Unknown'),
        'request_method': getattr(request, 'method', 'Unknown'),
        'request_path': getattr(request, 'path', 'Unknown'),
        'user': getattr(request, 'user.username', 'anonymous') if hasattr(request, 'user') else 'anonymous',
        'ip': _get_client_ip(request) if request else 'Unknown',
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
    }
    
    # Add traceback for unexpected exceptions
    if not isinstance(exc, (Http404, PermissionDenied, ValidationError, APIException)):
        log_data['traceback'] = traceback.format_exc()
    
    logger.error(f"Exception occurred: {log_data}", exc_info=True)


def _enhance_response(response, exc, context):
    """Enhance DRF response with additional context"""
    
    request = context.get('request')
    
    # Add request ID for tracing
    if request and hasattr(request, 'request_id'):
        response.data['request_id'] = request.request_id
    
    # Add error context
    response.data['error_context'] = {
        'view': context.get('view', {}).__class__.__name__,
        'method': context.get('view', {}).action if hasattr(context.get('view', {}), 'action') else 'Unknown',
        'timestamp': getattr(request, 'start_time', None) if request else None,
    }
    
    return response


def _handle_404(exc, context):
    """Handle 404 Not Found exceptions"""
    
    request = context.get('request')
    
    response_data = {
        'error': 'Resource not found',
        'detail': str(exc),
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
        'error_code': 'NOT_FOUND',
        'suggestions': [
            'Check the URL path for typos',
            'Verify the resource ID exists',
            'Ensure you have proper permissions'
        ]
    }
    
    return Response(response_data, status=status.HTTP_404_NOT_FOUND)


def _handle_permission_denied(exc, context):
    """Handle permission denied exceptions"""
    
    request = context.get('request')
    
    response_data = {
        'error': 'Permission denied',
        'detail': str(exc),
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
        'error_code': 'PERMISSION_DENIED',
        'suggestions': [
            'Check your authentication status',
            'Verify you have the required permissions',
            'Contact an administrator if you believe this is an error'
        ]
    }
    
    return Response(response_data, status=status.HTTP_403_FORBIDDEN)


def _handle_validation_error(exc, context):
    """Handle validation errors"""
    
    request = context.get('request')
    
    # Extract field-specific errors
    field_errors = {}
    if hasattr(exc, 'error_dict'):
        for field, errors in exc.error_dict.items():
            field_errors[field] = [str(error) for error in errors]
    elif hasattr(exc, 'error_list'):
        field_errors['non_field_errors'] = [str(error) for error in exc.error_list]
    
    response_data = {
        'error': 'Validation error',
        'detail': str(exc),
        'field_errors': field_errors,
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
        'error_code': 'VALIDATION_ERROR',
        'suggestions': [
            'Check the provided data format',
            'Verify all required fields are present',
            'Ensure data meets validation requirements'
        ]
    }
    
    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)


def _handle_integrity_error(exc, context):
    """Handle database integrity errors"""
    
    request = context.get('request')
    
    response_data = {
        'error': 'Data integrity error',
        'detail': str(exc),
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
        'error_code': 'INTEGRITY_ERROR',
        'suggestions': [
            'Check for duplicate entries',
            'Verify foreign key relationships',
            'Ensure unique constraints are met'
        ]
    }
    
    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)


def _handle_database_error(exc, context):
    """Handle database errors"""
    
    request = context.get('request')
    
    response_data = {
        'error': 'Database error',
        'detail': str(exc),
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
        'error_code': 'DATABASE_ERROR',
        'suggestions': [
            'Try again in a few moments',
            'Contact support if the problem persists',
            'Check system status'
        ]
    }
    
    return Response(response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _handle_unexpected_exception(exc, context):
    """Handle unexpected exceptions"""
    
    request = context.get('request')
    
    response_data = {
        'error': 'Internal server error',
        'detail': 'An unexpected error occurred',
        'request_id': getattr(request, 'request_id', 'Unknown') if request else 'Unknown',
        'error_code': 'INTERNAL_ERROR',
        'error_id': str(id(exc)),  # For internal tracking
        'suggestions': [
            'Try again in a few moments',
            'Contact support with the error ID',
            'Check system logs for more details'
        ]
    }
    
    # In development, include more details
    if getattr(settings, 'DEBUG', False):
        response_data['exception_type'] = type(exc).__name__
        response_data['exception_message'] = str(exc)
        response_data['traceback'] = traceback.format_exc()
    
    return Response(response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_client_ip(request):
    """Extract client IP address from request"""
    if not request:
        return 'Unknown'
    
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


class PractikaException(APIException):
    """
    Base exception class for Practika-specific errors
    """
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'An error occurred in the Practika system.'
    default_code = 'practika_error'
    
    def __init__(self, detail=None, code=None, error_code=None, suggestions=None):
        super().__init__(detail, code)
        self.error_code = error_code or self.default_code
        self.suggestions = suggestions or []


class VideoProcessingError(PractikaException):
    """Exception for video processing errors"""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = 'Video processing failed.'
    default_code = 'video_processing_error'


class StorageError(PractikaException):
    """Exception for storage-related errors"""
    status_code = status.HTTP_507_INSUFFICIENT_STORAGE
    default_detail = 'Storage operation failed.'
    default_code = 'storage_error'


class ValidationError(PractikaException):
    """Exception for validation errors"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Data validation failed.'
    default_code = 'validation_error'
