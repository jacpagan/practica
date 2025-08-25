import time
import json
import logging
import psutil
import threading
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import uuid
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.http import Http404
import re

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware for comprehensive request logging and monitoring
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.request_logger = logging.getLogger('core.request')
        self.security_logger = logging.getLogger('django.security')
    
    def process_request(self, request):
        # Generate unique request ID
        request.request_id = str(uuid.uuid4())
        
        # Log request details
        request.start_time = time.time()
        
        # Log request information
        log_data = {
            'request_id': request.request_id,
            'method': request.method,
            'path': request.path,
            'user': request.user.username if request.user.is_authenticated else 'anonymous',
            'ip': self._get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'timestamp': time.time(),
        }
        
        # Log query parameters for GET requests
        if request.method == 'GET' and request.GET:
            log_data['query_params'] = dict(request.GET)
        
        # Log request body for POST/PUT/PATCH requests (excluding file uploads)
        if request.method in ['POST', 'PUT', 'PATCH'] and request.content_type != 'multipart/form-data':
            try:
                if hasattr(request, 'body'):
                    body = request.body.decode('utf-8')
                    if len(body) < 1000:  # Only log small bodies
                        log_data['request_body'] = body
            except Exception as e:
                log_data['body_error'] = str(e)
        
        self.request_logger.info(f"Request started: {json.dumps(log_data)}")
        
        # Security logging for suspicious requests
        self._log_security_events(request, log_data)
        
        return None
    
    def process_response(self, request, response):
        # Calculate request duration
        duration = time.time() - request.start_time
        
        # Log response details
        response_data = {
            'request_id': getattr(request, 'request_id', 'unknown'),
            'method': request.method,
            'path': request.path,
            'status_code': response.status_code,
            'duration': round(duration, 4),
            'user': request.user.username if request.user.is_authenticated else 'anonymous',
            'ip': self._get_client_ip(request),
            'timestamp': time.time(),
        }
        
        # Add response headers for debugging
        if settings.DEBUG:
            response_data['response_headers'] = dict(response.headers)
        
        # Log slow requests
        if duration > 1.0:  # Log requests taking more than 1 second
            self.request_logger.warning(f"Slow request: {json.dumps(response_data)}")
        else:
            self.request_logger.info(f"Request completed: {json.dumps(response_data)}")
        
        # Add request ID to response headers for tracing
        response['X-Request-ID'] = getattr(request, 'request_id', 'unknown')
        response['X-Response-Time'] = f"{duration:.4f}s"
        
        return response
    
    def process_exception(self, request, exception):
        # Log exceptions with full context
        exception_data = {
            'request_id': getattr(request, 'request_id', 'unknown'),
            'method': request.method,
            'path': request.path,
            'user': request.user.username if request.user.is_authenticated else 'anonymous',
            'ip': self._get_client_ip(request),
            'exception_type': type(exception).__name__,
            'exception_message': str(exception),
            'timestamp': time.time(),
        }
        
        self.request_logger.error(f"Request exception: {json.dumps(exception_data)}", exc_info=True)
        return None
    
    def _get_client_ip(self, request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def _log_security_events(self, request, log_data):
        """Log potential security events"""
        # Log failed authentication attempts
        if request.path.startswith('/admin/login/') and request.method == 'POST':
            self.security_logger.info(f"Admin login attempt: {json.dumps(log_data)}")
        
        # Log suspicious patterns
        suspicious_patterns = [
            'script', 'javascript:', 'vbscript:', 'onload=', 'onerror=',
            'union select', 'drop table', 'insert into', 'delete from'
        ]
        
        request_string = f"{request.path} {request.META.get('QUERY_STRING', '')}"
        for pattern in suspicious_patterns:
            if pattern.lower() in request_string.lower():
                self.security_logger.warning(f"Suspicious request pattern detected: {pattern} in {json.dumps(log_data)}")
                break


class PerformanceMonitoringMiddleware(MiddlewareMixin):
    """
    Middleware for monitoring database performance, memory usage, and system metrics
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.performance_logger = logging.getLogger('core.performance')
        self.monitoring_enabled = getattr(settings, 'PERFORMANCE_MONITORING', {}).get('ENABLED', True)
        self.slow_query_threshold = getattr(settings, 'PERFORMANCE_MONITORING', {}).get('SLOW_QUERY_THRESHOLD', 1.0)
        self.log_slow_queries = getattr(settings, 'PERFORMANCE_MONITORING', {}).get('LOG_SLOW_QUERIES', True)
        self.log_memory_usage = getattr(settings, 'PERFORMANCE_MONITORING', {}).get('LOG_MEMORY_USAGE', True)
    
    def process_request(self, request):
        if not self.monitoring_enabled:
            return None
        
        # Reset query count and time
        request.query_count = 0
        request.query_time = 0
        request.start_memory = psutil.Process().memory_info().rss if self.log_memory_usage else 0
        
        # Store initial database state
        if hasattr(connection, 'queries'):
            request.initial_queries = len(connection.queries)
            request.initial_query_time = sum(float(q.get('time', 0)) for q in connection.queries)
        
        return None
    
    def process_response(self, request, response):
        if not self.monitoring_enabled:
            return response
        
        # Calculate database metrics
        if hasattr(connection, 'queries'):
            final_queries = len(connection.queries)
            final_query_time = sum(float(q.get('time', 0)) for q in connection.queries)
            
            request.query_count = final_queries - getattr(request, 'initial_queries', 0)
            request.query_time = final_query_time - getattr(request, 'initial_query_time', 0)
            
            # Log slow queries
            if self.log_slow_queries and request.query_time > self.slow_query_threshold:
                self._log_slow_query(request, response)
        
        # Log memory usage
        if self.log_memory_usage:
            end_memory = psutil.Process().memory_info().rss
            memory_diff = end_memory - getattr(request, 'start_memory', 0)
            
            if memory_diff > 1024 * 1024:  # Log if memory usage increased by more than 1MB
                self.performance_logger.info(
                    f"Memory usage for {request.path}: {memory_diff / (1024*1024):.2f}MB increase"
                )
        
        # Log performance summary for slow requests
        if request.query_time > 0.5:  # Log requests with significant database time
            self.performance_logger.info(
                f"Performance summary for {request.path}: "
                f"{request.query_count} queries, {request.query_time:.4f}s total"
            )
        
        return response
    
    def _log_slow_query(self, request, response):
        """Log detailed information about slow queries"""
        slow_queries = []
        for query in connection.queries:
            query_time = float(query.get('time', 0))
            if query_time > self.slow_query_threshold:
                slow_queries.append({
                    'sql': query.get('sql', ''),
                    'time': query_time,
                    'raw_sql': query.get('raw_sql', ''),
                })
        
        if slow_queries:
            self.performance_logger.warning(
                f"Slow queries detected for {request.path}: {json.dumps(slow_queries)}"
            )


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Middleware for adding security headers to responses
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.security_headers = getattr(settings, 'SECURITY_HEADERS', {})
    
    def process_response(self, request, response):
        # Add security headers
        for header, value in self.security_headers.items():
            if value:
                response[header] = value
        
        # Add additional security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Add HSTS header for HTTPS
        if request.is_secure():
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response


class DatabaseConnectionMiddleware(MiddlewareMixin):
    """
    Middleware for monitoring and managing database connections
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.db_logger = logging.getLogger('django.db.backends')
    
    def process_request(self, request):
        # Log database connection status
        if hasattr(connection, 'connection'):
            try:
                if connection.connection:
                    self.db_logger.debug(f"Database connection active for {request.path}")
                else:
                    self.db_logger.warning(f"No database connection for {request.path}")
            except Exception as e:
                self.db_logger.error(f"Database connection error: {e}")
        
        return None
    
    def process_response(self, request, response):
        # Check for database connection leaks
        if hasattr(connection, 'connection') and connection.connection:
            try:
                # Test connection health
                connection.connection.ping()
            except Exception as e:
                self.db_logger.error(f"Database connection health check failed: {e}")
        
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """
    Middleware for implementing rate limiting
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.rate_limiting = getattr(settings, 'RATE_LIMITING', {})
        self.enabled = self.rate_limiting.get('ENABLED', True)
        self.default_rate = self.rate_limiting.get('DEFAULT_RATE', '100/hour')
        self.burst_rate = self.rate_limiting.get('BURST_RATE', '200/hour')
    
    def process_request(self, request):
        if not self.enabled:
            return None
        
        # Simple rate limiting based on IP
        client_ip = self._get_client_ip(request)
        cache_key = f"rate_limit:{client_ip}"
        
        # Get current request count
        request_count = cache.get(cache_key, 0)
        
        if request_count >= 100:  # Basic limit
            return JsonResponse({
                'error': 'Rate limit exceeded',
                'retry_after': 3600  # 1 hour
            }, status=429)
        
        # Increment request count
        cache.set(cache_key, request_count + 1, 3600)  # Expire after 1 hour
        
        return None
    
    def _get_client_ip(self, request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class SecurityMiddleware(MiddlewareMixin):
    """
    Middleware for enhanced security features including:
    - Login rate limiting
    - Account lockout after failed attempts
    - Security event logging
    - Upload rate limiting
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        self.security_logger = logging.getLogger('django.security')
        self.User = get_user_model()
        
        # Security settings
        self.rate_limit_enabled = getattr(settings, 'RATE_LIMIT_ENABLED', False)
        self.login_rate_limit = getattr(settings, 'LOGIN_RATE_LIMIT', '5/minute')
        self.upload_rate_limit = getattr(settings, 'UPLOAD_RATE_LIMIT', '10/minute')
        self.failed_login_limit = getattr(settings, 'FAILED_LOGIN_ATTEMPTS_LIMIT', 5)
        self.lockout_duration = getattr(settings, 'ACCOUNT_LOCKOUT_DURATION', 300)
        
    def process_request(self, request):
        """Process incoming requests for security checks"""
        if not self.rate_limit_enabled:
            return None
            
        # Check for login attempts
        if self._is_login_attempt(request):
            if self._is_account_locked(request):
                self._log_security_event('account_locked', request, {
                    'ip': self._get_client_ip(request),
                    'username': request.POST.get('username', 'unknown')
                })
                raise PermissionDenied("Account temporarily locked due to multiple failed login attempts")
            
            if self._is_rate_limited(request, 'login'):
                self._log_security_event('rate_limit_exceeded', request, {
                    'ip': self._get_client_ip(request),
                    'type': 'login'
                })
                raise PermissionDenied("Too many login attempts. Please try again later.")
        
        # Check for upload attempts
        if self._is_upload_attempt(request):
            if self._is_rate_limited(request, 'upload'):
                self._log_security_event('rate_limit_exceeded', request, {
                    'ip': self._get_client_ip(request),
                    'type': 'upload'
                })
                raise PermissionDenied("Too many upload attempts. Please try again later.")
        
        return None
    
    def process_response(self, request, response):
        """Process responses for security logging"""
        if self.rate_limit_enabled and self._is_login_attempt(request):
            if response.status_code == 200 and request.user.is_authenticated:
                # Successful login - reset failed attempts
                self._reset_failed_attempts(request)
            elif response.status_code == 200 and not request.user.is_authenticated:
                # Failed login - increment failed attempts
                self._increment_failed_attempts(request)
        
        return response
    
    def _is_login_attempt(self, request):
        """Check if this is a login attempt"""
        return (request.path.endswith('/login/') and 
                request.method == 'POST' and 
                'username' in request.POST and 
                'password' in request.POST)
    
    def _is_upload_attempt(self, request):
        """Check if this is a file upload attempt"""
        return (request.method == 'POST' and 
                request.content_type and 
                request.content_type.startswith('multipart/form-data'))
    
    def _is_rate_limited(self, request, action_type):
        """Check if request is rate limited"""
        ip = self._get_client_ip(request)
        cache_key = f"rate_limit:{action_type}:{ip}"
        
        current_count = cache.get(cache_key, 0)
        if action_type == 'login':
            limit = int(self.login_rate_limit.split('/')[0])
            period = self.login_rate_limit.split('/')[1]
        else:  # upload
            limit = int(self.upload_rate_limit.split('/')[0])
            period = self.upload_rate_limit.split('/')[1]
        
        # Convert period to seconds
        if period == 'minute':
            period_seconds = 60
        elif period == 'hour':
            period_seconds = 3600
        else:
            period_seconds = 60  # default to minute
        
        if current_count >= limit:
            return True
        
        # Increment counter
        cache.set(cache_key, current_count + 1, period_seconds)
        return False
    
    def _is_account_locked(self, request):
        """Check if account is locked due to failed attempts"""
        username = request.POST.get('username', '')
        if not username:
            return False
            
        lockout_key = f"account_lockout:{username}"
        return cache.get(lockout_key, False)
    
    def _increment_failed_attempts(self, request):
        """Increment failed login attempts for a username"""
        username = request.POST.get('username', '')
        if not username:
            return
            
        failed_key = f"failed_login:{username}"
        current_failed = cache.get(failed_key, 0)
        new_failed = current_failed + 1
        
        cache.set(failed_key, new_failed, 300)  # 5 minutes
        
        # Log failed attempt
        self._log_security_event('failed_login', request, {
            'username': username,
            'ip': self._get_client_ip(request),
            'attempts': new_failed
        })
        
        # Lock account if limit reached
        if new_failed >= self.failed_login_limit:
            lockout_key = f"account_lockout:{username}"
            cache.set(lockout_key, True, self.lockout_duration)
            
            self._log_security_event('account_locked', request, {
                'username': username,
                'ip': self._get_client_ip(request),
                'duration': self.lockout_duration
            })
    
    def _reset_failed_attempts(self, request):
        """Reset failed login attempts for a username"""
        username = request.POST.get('username', '')
        if not username:
            return
            
        failed_key = f"failed_login:{username}"
        lockout_key = f"account_lockout:{username}"
        
        cache.delete(failed_key)
        cache.delete(lockout_key)
        
        self._log_security_event('successful_login', request, {
            'username': username,
            'ip': self._get_client_ip(request)
        })
    
    def _get_client_ip(self, request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def _log_security_event(self, event_type, request, data):
        """Log security events"""
        log_data = {
            'event_type': event_type,
            'timestamp': time.time(),
            'ip': self._get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'path': request.path,
            'method': request.method,
            **data
        }
        
        self.security_logger.warning(f"Security event: {json.dumps(log_data)}")


class MobileOptimizationMiddleware(MiddlewareMixin):
    """
    Middleware for optimizing the application for mobile devices
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def process_request(self, request):
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        
        # Enhanced device detection for cross-compatibility
        request.is_mobile = any(device in user_agent for device in [
            'iphone', 'ipad', 'ipod', 'android', 'blackberry', 'windows phone',
            'mobile', 'tablet', 'phone', 'opera mini', 'mobile safari'
        ])
        
        # Detailed device type detection with iPhone SE support
        if 'iphone' in user_agent:
            request.device_type = 'iphone'
            request.ios_version = self.extract_ios_version(user_agent)
            request.is_old_ios = self.is_old_ios_version(request.ios_version)
            request.is_iphone_se = self.is_iphone_se(user_agent)
            # iPhone SE devices are always considered small screen
            request.is_small_screen = request.is_iphone_se or self.is_small_screen_device(user_agent)
        elif 'ipad' in user_agent:
            request.device_type = 'ipad'
            request.ios_version = self.extract_ios_version(user_agent)
            request.is_old_ios = self.is_old_ios_version(request.ios_version)
            request.is_iphone_se = False
            request.is_small_screen = False
        elif 'android' in user_agent:
            request.device_type = 'android'
            request.android_version = self.extract_android_version(user_agent)
            request.is_old_android = self.is_old_android_version(request.android_version)
            request.is_iphone_se = False
            request.is_small_screen = self.is_small_screen_android(user_agent)
        else:
            request.device_type = 'desktop'
            request.ios_version = None
            request.android_version = None
            request.is_old_ios = False
            request.is_old_android = False
            request.is_iphone_se = False
            request.is_small_screen = False
        
        # Set mobile settings based on device capabilities
        if request.is_mobile:
            if hasattr(request, 'is_old_ios') and request.is_old_ios:
                # Older iOS devices (before iOS 14) - iPhone 12 SE and older
                request.mobile_settings = {
                    'video_quality': '480p',
                    'max_recording_time': 180,
                    'use_fallback_methods': True,
                    'enable_legacy_support': True,
                    'compression_level': 'high',
                    'cache_strategy': 'aggressive',
                    'pwa_features': 'limited',
                    'touch_target_size': 'large',  # 48px+ for older devices
                    'animation_reduction': True,
                    'performance_mode': 'conservative'
                }
            elif hasattr(request, 'is_old_android') and request.is_old_android:
                # Older Android devices (before Android 10)
                request.mobile_settings = {
                    'video_quality': '480p',
                    'max_recording_time': 180,
                    'use_fallback_methods': True,
                    'enable_legacy_support': True,
                    'compression_level': 'high',
                    'cache_strategy': 'aggressive',
                    'pwa_features': 'limited',
                    'touch_target_size': 'large',
                    'animation_reduction': True,
                    'performance_mode': 'conservative'
                }
            elif hasattr(request, 'is_iphone_se') and request.is_iphone_se:
                # iPhone SE specific optimizations
                request.mobile_settings = {
                    'video_quality': '720p',
                    'max_recording_time': 240,
                    'use_fallback_methods': False,
                    'enable_legacy_support': False,
                    'compression_level': 'medium',
                    'cache_strategy': 'standard',
                    'pwa_features': 'full',
                    'touch_target_size': 'medium',  # 44px+ for SE
                    'animation_reduction': False,
                    'performance_mode': 'balanced'
                }
            elif hasattr(request, 'is_small_screen') and request.is_small_screen:
                # Small screen devices (iPhone SE, older Android)
                request.mobile_settings = {
                    'video_quality': '720p',
                    'max_recording_time': 240,
                    'use_fallback_methods': False,
                    'enable_legacy_support': False,
                    'compression_level': 'medium',
                    'cache_strategy': 'standard',
                    'pwa_features': 'full',
                    'touch_target_size': 'medium',
                    'animation_reduction': False,
                    'performance_mode': 'balanced'
                }
            else:
                # Modern devices
                request.mobile_settings = {
                    'video_quality': '720p',
                    'max_recording_time': 300,
                    'use_fallback_methods': False,
                    'enable_legacy_support': False,
                    'compression_level': 'medium',
                    'cache_strategy': 'standard',
                    'pwa_features': 'full',
                    'touch_target_size': 'standard',  # 44px
                    'animation_reduction': False,
                    'performance_mode': 'optimized'
                }
        else:
            # Desktop settings
            request.mobile_settings = {
                'video_quality': '1080p',
                'max_recording_time': 600,
                'use_fallback_methods': False,
                'enable_legacy_support': False,
                'compression_level': 'low',
                'cache_strategy': 'minimal',
                'pwa_features': 'none',
                'touch_target_size': 'standard',
                'animation_reduction': False,
                'performance_mode': 'optimized'
            }
        
        return None
    
    def extract_ios_version(self, user_agent):
        """Extract iOS version from user agent string."""
        match = re.search(r'os (\d+)_', user_agent)
        if match:
            return int(match.group(1))
        return None
    
    def extract_android_version(self, user_agent):
        """Extract Android version from user agent string."""
        match = re.search(r'android (\d+)', user_agent)
        if match:
            return int(match.group(1))
        return None
    
    def is_old_ios_version(self, version):
        """Check if iOS version is considered old (before iOS 14)."""
        if version is None:
            return False
        return version < 14
    
    def is_old_android_version(self, version):
        """Check if Android version is considered old (before Android 10)."""
        if version is None:
            return False
        return version < 10
    
    def is_iphone_se(self, user_agent):
        """Detect iPhone SE models (1st and 2nd generation)."""
        # iPhone SE models have specific identifiers
        se_identifiers = [
            'iphone8,4',  # iPhone SE 1st gen
            'iphone12,8', # iPhone SE 2nd gen
            'iphone14,6', # iPhone SE 3rd gen
        ]
        
        # Check for iPhone SE in user agent
        if 'iphone' in user_agent:
            # Look for device identifiers
            for identifier in se_identifiers:
                if identifier in user_agent:
                    return True
            
            # Fallback: check for small screen indicators
            if 'mobile' in user_agent and 'safari' in user_agent:
                return True
        
        return False
    
    def is_small_screen_device(self, user_agent):
        """Detect small screen devices that need special handling."""
        # iPhone SE and similar small devices
        small_device_indicators = [
            'iphone8,4',   # iPhone SE 1st gen
            'iphone12,8',  # iPhone SE 2nd gen
            'iphone14,6',  # iPhone SE 3rd gen
            'iphone8,1',   # iPhone 6s
            'iphone8,2',   # iPhone 6s Plus
            'iphone9,1',   # iPhone 7
            'iphone9,3',   # iPhone 7
        ]
        
        for indicator in small_device_indicators:
            if indicator in user_agent:
                return True
        
        return False
    
    def is_small_screen_android(self, user_agent):
        """Detect small screen Android devices."""
        # Look for indicators of small Android devices
        small_android_indicators = [
            'mobile',
            'phone',
            'android'
        ]
        
        # Check if it's a mobile device with small screen characteristics
        if all(indicator in user_agent for indicator in small_android_indicators):
            return True
        
        return False
    
    def process_response(self, request, response):
        if hasattr(request, 'is_mobile') and request.is_mobile:
            # Add device-specific headers
            response['X-Device-Type'] = getattr(request, 'device_type', 'unknown')
            response['X-Mobile-Optimized'] = 'true'
            
            # Add compatibility headers
            if hasattr(request, 'is_old_ios') and request.is_old_ios:
                response['X-Legacy-iOS'] = 'true'
                response['X-Fallback-Methods'] = 'enabled'
                response['X-Performance-Mode'] = 'conservative'
            elif hasattr(request, 'is_old_android') and request.is_old_android:
                response['X-Legacy-Android'] = 'true'
                response['X-Fallback-Methods'] = 'enabled'
                response['X-Performance-Mode'] = 'conservative'
            elif hasattr(request, 'is_iphone_se') and request.is_iphone_se:
                response['X-iPhone-SE'] = 'true'
                response['X-Small-Screen'] = 'true'
                response['X-Performance-Mode'] = 'balanced'
            elif hasattr(request, 'is_small_screen') and request.is_small_screen:
                response['X-Small-Screen'] = 'true'
                response['X-Performance-Mode'] = 'balanced'
            else:
                response['X-Performance-Mode'] = 'optimized'
            
            # Add mobile settings headers
            if hasattr(request, 'mobile_settings'):
                response['X-Video-Quality'] = request.mobile_settings.get('video_quality', 'unknown')
                response['X-Max-Recording-Time'] = str(request.mobile_settings.get('max_recording_time', 0))
                response['X-Legacy-Support'] = str(request.mobile_settings.get('enable_legacy_support', False)).lower()
                response['X-Touch-Target-Size'] = request.mobile_settings.get('touch_target_size', 'standard')
                response['X-Animation-Reduction'] = str(request.mobile_settings.get('animation_reduction', False)).lower()
                response['X-Performance-Mode'] = request.mobile_settings.get('performance_mode', 'standard')
            
            # Optimize caching for mobile devices
            if request.path.startswith('/static/') or request.path.startswith('/media/'):
                if hasattr(request, 'mobile_settings') and request.mobile_settings.get('cache_strategy') == 'aggressive':
                    response['Cache-Control'] = 'public, max-age=604800'  # 1 week for older devices
                else:
                    response['Cache-Control'] = 'public, max-age=31536000'  # 1 year for modern devices
            
            # Security headers optimized for mobile
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'DENY'
            
            # Compression for mobile (if content is large enough)
            if hasattr(response, 'content') and response.content and len(response.content) > 1024:
                if hasattr(request, 'mobile_settings') and request.mobile_settings.get('cache_strategy') == 'aggressive':
                    # More aggressive compression for older devices
                    response['Content-Encoding'] = 'gzip'
                    response['Vary'] = 'Accept-Encoding'
        
        return response
    
    def process_exception(self, request, exception):
        if hasattr(request, 'is_mobile') and request.is_mobile:
            logger.error(f"Mobile error on {request.path}: {exception}")
            
            if isinstance(exception, Http404):
                # Mobile-friendly 404 response
                return JsonResponse({
                    'error': 'Page not found',
                    'mobile_friendly': True,
                    'device_type': getattr(request, 'device_type', 'unknown'),
                    'is_iphone_se': getattr(request, 'is_iphone_se', False),
                    'is_small_screen': getattr(request, 'is_small_screen', False),
                    'suggestions': ['Check the URL', 'Go back to home', 'Try refreshing the page'],
                    'fallback_available': hasattr(request, 'mobile_settings') and request.mobile_settings.get('use_fallback_methods', False)
                }, status=404)
            
            # Handle other mobile-specific errors
            if hasattr(request, 'mobile_settings') and request.mobile_settings.get('use_fallback_methods', False):
                logger.info(f"Fallback methods available for device: {getattr(request, 'device_type', 'unknown')}")
        
        return None

class DeviceCompatibilityMiddleware(MiddlewareMixin):
    """Middleware to handle device compatibility and feature detection."""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.supported_features = {
            'media_recorder': 'MediaRecorder API support',
            'get_user_media': 'Camera/Microphone access',
            'canvas_capture': 'Canvas video capture',
            'file_api': 'File API support',
            'service_worker': 'Service Worker support',
            'web_assembly': 'WebAssembly support',
            'webgl': 'WebGL support'
        }
    
    def process_request(self, request):
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Detect browser capabilities
        request.browser_capabilities = self.detect_browser_capabilities(user_agent)
        
        # Set compatibility flags
        request.needs_fallback = self.needs_fallback_methods(request.browser_capabilities)
        request.supported_video_formats = self.get_supported_video_formats(request.browser_capabilities)
        
        return None
    
    def detect_browser_capabilities(self, user_agent):
        """Detect browser capabilities based on user agent."""
        capabilities = {}
        
        # iOS Safari detection
        if 'safari' in user_agent and ('iphone' in user_agent or 'ipad' in user_agent):
            ios_version = re.search(r'os (\d+)_', user_agent)
            if ios_version:
                ios_ver = int(ios_version.group(1))
                capabilities['media_recorder'] = ios_ver >= 14
                capabilities['get_user_media'] = ios_ver >= 11
                capabilities['canvas_capture'] = ios_ver >= 12
                capabilities['service_worker'] = ios_ver >= 11
                capabilities['web_assembly'] = ios_ver >= 11
                capabilities['webgl'] = ios_ver >= 8
        
        # Android Chrome detection
        elif 'chrome' in user_agent and 'android' in user_agent:
            android_version = re.search(r'android (\d+)', user_agent)
            if android_version:
                android_ver = int(android_version.group(1))
                capabilities['media_recorder'] = android_ver >= 5
                capabilities['get_user_media'] = android_ver >= 4
                capabilities['canvas_capture'] = android_ver >= 5
                capabilities['service_worker'] = android_ver >= 5
                capabilities['web_assembly'] = android_ver >= 5
                capabilities['webgl'] = android_ver >= 4
        
        # Modern browsers
        elif any(browser in user_agent for browser in ['chrome', 'firefox', 'edge']):
            capabilities['media_recorder'] = True
            capabilities['get_user_media'] = True
            capabilities['canvas_capture'] = True
            capabilities['service_worker'] = True
            capabilities['web_assembly'] = True
            capabilities['webgl'] = True
        
        # Legacy browsers
        else:
            capabilities['media_recorder'] = False
            capabilities['get_user_media'] = False
            capabilities['canvas_capture'] = False
            capabilities['service_worker'] = False
            capabilities['web_assembly'] = False
            capabilities['webgl'] = False
        
        return capabilities
    
    def needs_fallback_methods(self, capabilities):
        """Determine if fallback methods are needed."""
        return not capabilities.get('media_recorder', False) or not capabilities.get('get_user_media', False)
    
    def get_supported_video_formats(self, capabilities):
        """Get supported video formats for the device."""
        if capabilities.get('media_recorder', False):
            return ['webm', 'mp4', 'ogg']
        else:
            return ['mp4', 'mov', 'avi']  # Fallback formats

class RequestIDFilter(logging.Filter):
    """Filter to add request_id to log records."""
    
    def filter(self, record):
        # Get request_id from thread local storage
        request_id = getattr(threading.current_thread(), '_request_id', 'unknown')
        record.request_id = request_id
        return True
