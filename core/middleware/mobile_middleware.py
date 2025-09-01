"""
Mobile optimization middleware
"""
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class DeviceOptimizationMiddleware(MiddlewareMixin):
    """Optimize responses for different device types"""
    
    def process_request(self, request):
        # Detect device type
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        
        # Initialize mobile settings with comprehensive defaults
        request.mobile_settings = {
            'video_quality': '720p',
            'max_recording_time': 300,
            'use_fallback_methods': True,
            'enable_legacy_support': False,
            'compression_level': 'medium',
            'cache_strategy': 'aggressive',
            'pwa_features': True,
            'touch_target_size': 'large',
            'animation_reduction': False,
            'performance_mode': 'balanced'
        }
        
        # Detect specific device types
        if 'android' in user_agent:
            request.device_type = 'android'
            request.is_mobile = True
            request.mobile_settings['platform'] = 'android'
            request.mobile_settings['version'] = self.extract_android_version(user_agent)
            
            # Detect old Android versions
            version = self.extract_android_version(user_agent)
            if version and version < 10:
                request.is_old_android = True
                request.mobile_settings['enable_legacy_support'] = True
                request.mobile_settings['performance_mode'] = 'conservative'
            else:
                request.is_old_android = False
                
        elif 'iphone' in user_agent:
            request.device_type = 'iphone'
            request.is_mobile = True
            request.mobile_settings['platform'] = 'ios'
            request.mobile_settings['version'] = self.extract_ios_version(user_agent)
            
            # Detect iPhone SE specifically
            if 'iphone' in user_agent and ('se' in user_agent or 'iphone se' in user_agent):
                request.is_iphone_se = True
                request.mobile_settings['touch_target_size'] = 'extra_large'
            else:
                request.is_iphone_se = False
            
            # Detect old iOS versions
            version = self.extract_ios_version(user_agent)
            if version and version < 14:
                request.is_old_ios = True
                request.mobile_settings['enable_legacy_support'] = True
                request.mobile_settings['animation_reduction'] = True
            else:
                request.is_old_ios = False
                
        elif 'ipad' in user_agent:
            request.device_type = 'ipad'
            request.is_mobile = True
            request.mobile_settings['platform'] = 'ios'
            request.mobile_settings['version'] = self.extract_ios_version(user_agent)
            
            # iPads are generally not considered small screen
            request.is_small_screen = False
            
        elif any(device in user_agent for device in ['mobile', 'tablet']):
            request.device_type = 'mobile'
            request.is_mobile = True
        else:
            request.device_type = 'desktop'
            request.is_mobile = False
            # Desktop devices don't have these mobile attributes
            request.is_old_android = False
            request.is_old_ios = False
            request.is_iphone_se = False
        
        # Detect small screen devices (default to mobile devices, but desktop is False)
        if not hasattr(request, 'is_small_screen'):
            request.is_small_screen = request.is_mobile
        
        return None
    
    def process_response(self, request, response):
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Add mobile-specific headers
            response['Vary'] = 'User-Agent'
            response['X-Mobile-Optimized'] = 'true'
            response['X-Device-Type'] = getattr(request, 'device_type', 'mobile')
            
            # Add iPhone SE specific header
            if hasattr(request, 'is_iphone_se') and request.is_iphone_se:
                response['X-iPhone-SE'] = 'true'
            
            # Add legacy iOS header for old devices
            if hasattr(request, 'mobile_settings') and request.mobile_settings.get('platform') == 'ios':
                version = request.mobile_settings.get('version', '0')
                if version:
                    # Handle both string and integer versions
                    if isinstance(version, str):
                        version_num = float(version.split('.')[0])
                    else:
                        version_num = float(version)
                    if version_num < 12:
                        response['X-Legacy-iOS'] = 'true'
        
        return response
    
    def extract_android_version(self, user_agent):
        """Extract Android version from user agent"""
        import re
        match = re.search(r'android\s+(\d+(?:\.\d+)*)', user_agent, re.IGNORECASE)
        if match:
            version_str = match.group(1)
            # Return major version as integer for tests
            return int(version_str.split('.')[0])
        return None
    
    def extract_ios_version(self, user_agent):
        """Extract iOS version from user agent"""
        import re
        match = re.search(r'os\s+(\d+(?:_\d+)*)', user_agent, re.IGNORECASE)
        if match:
            version_str = match.group(1).replace('_', '.')
            # Return major version as integer for tests
            return int(version_str.split('.')[0])
        return None
    
    def process_exception(self, request, exception):
        """Handle exceptions for mobile devices"""
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Log mobile-specific errors
            logger.error(f"Mobile error: {exception} for device {getattr(request, 'device_type', 'unknown')}")
            
            # Return mobile-friendly error responses for common exceptions
            from django.http import Http404, HttpResponse
            from django.template.loader import render_to_string
            
            if isinstance(exception, Http404):
                # Return a mobile-friendly 404 response
                content = render_to_string('404_mobile.html', {
                    'device_type': getattr(request, 'device_type', 'mobile'),
                    'is_small_screen': getattr(request, 'is_small_screen', True)
                }, request=request)
                return HttpResponse(content, status=404)
        
        return None


# Backwards compatibility alias for tests expecting MobileOptimizationMiddleware
class MobileOptimizationMiddleware(DeviceOptimizationMiddleware):
    pass


class SecurityMiddleware(MiddlewareMixin):
    """Add security headers to responses"""
    
    def process_response(self, request, response):
        # Security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response


class RequestIDFilter(logging.Filter):
    """Add request ID to log records"""
    
    def filter(self, record):
        # This will be set by the middleware
        record.request_id = getattr(record, 'request_id', 'no-request-id')
        return True
