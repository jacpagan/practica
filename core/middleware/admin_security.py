"""
Admin security middleware for enhanced protection
"""
import re
from django.http import HttpResponseForbidden
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class AdminSecurityMiddleware:
    """
    Enhanced security middleware for admin routes
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Only apply to admin routes
        if request.path.startswith('/admin/'):
            if not self._is_admin_access_allowed(request):
                logger.warning(f"Blocked admin access attempt from {self._get_client_ip(request)}")
                return HttpResponseForbidden(
                    'Access denied. Admin access is restricted.',
                    content_type='text/plain'
                )
        
        response = self.get_response(request)
        return response
        
    def _get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
        
    def _is_admin_access_allowed(self, request):
        """Check if admin access is allowed for this client"""
        client_ip = self._get_client_ip(request)
        
        # Get whitelisted IPs from settings
        admin_ip_whitelist = getattr(settings, 'ADMIN_IP_WHITELIST', [])
        
        # If no whitelist is set, allow all (but log for monitoring)
        if not admin_ip_whitelist:
            logger.info(f"Admin access from {client_ip} (no IP whitelist configured)")
            return True
            
        # Check if IP is whitelisted
        for allowed_ip in admin_ip_whitelist:
            if self._ip_matches(client_ip, allowed_ip):
                logger.info(f"Admin access granted to {client_ip}")
                return True
                
        logger.warning(f"Admin access denied to {client_ip}")
        return False
        
    def _ip_matches(self, client_ip, allowed_ip):
        """Check if client IP matches allowed IP pattern"""
        # Support for CIDR notation (e.g., 192.168.1.0/24)
        if '/' in allowed_ip:
            return self._ip_in_cidr(client_ip, allowed_ip)
        # Support for wildcards (e.g., 192.168.*.*)
        elif '*' in allowed_ip:
            pattern = allowed_ip.replace('.', '\\.').replace('*', '.*')
            return re.match(pattern, client_ip) is not None
        # Exact match
        else:
            return client_ip == allowed_ip
            
    def _ip_in_cidr(self, ip, cidr):
        """Check if IP is in CIDR range"""
        try:
            from ipaddress import ip_address, ip_network
            return ip_address(ip) in ip_network(cidr)
        except ImportError:
            # Fallback for older Python versions
            return ip == cidr.split('/')[0]
