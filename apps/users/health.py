# Health check view for Practika MVP
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    """Health check endpoint for load balancer"""
    return JsonResponse({
        'status': 'healthy',
        'service': 'practika-mvp',
        'version': '1.0.0'
    })


def landing_page(request):
    """Landing page for Practika MVP"""
    return JsonResponse({
        'message': 'Welcome to Practika MVP!',
        'description': 'A platform for students to record and organize their practice sessions through videos.',
        'version': '1.0.0',
        'endpoints': {
            'health_check': '/api/health/',
            'registration': '/api/auth/register/',
            'login': '/api/token/',
            'profile': '/api/auth/profile/',
            'playlists': '/api/playlists/',
            'public_playlists': '/api/playlists/public/',
            'admin': '/admin/'
        },
        'documentation': 'This is a REST API. Use POST /api/auth/register/ to create an account and POST /api/token/ to login.',
        'features': [
            'User registration and authentication',
            'Playlist creation and management',
            'Video upload and organization',
            'Trust scoring system',
            'Public playlist discovery'
        ]
    })
