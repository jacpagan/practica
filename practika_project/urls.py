# Main URL configuration for Practika MVP
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt


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


def frontend_ui(request):
    """Frontend UI for Practika MVP"""
    with open('frontend.html', 'r') as f:
        return HttpResponse(f.read(), content_type='text/html')


urlpatterns = [
    path('', frontend_ui, name='frontend'),
    path('admin/', admin.site.urls),
    path('api/', include('apps.users.urls')),
    path('api/public/playlists/', include('apps.users.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
