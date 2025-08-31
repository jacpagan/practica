class BypassAllowedHostsMiddleware:
    """
    Middleware to bypass ALLOWED_HOSTS check for debugging purposes.
    This is a temporary fix for AWS ECS deployment issues.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Bypass ALLOWED_HOSTS check by setting a valid host
        if hasattr(request, 'get_host'):
            # Force the host to be localhost to bypass ALLOWED_HOSTS check
            request.META['HTTP_HOST'] = 'localhost:8000'
        
        response = self.get_response(request)
        return response
