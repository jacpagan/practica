"""
URL configuration for practica project.
Your personal practice tracking system.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from videos.views import ExerciseVideoViewSet

# API Router
router = DefaultRouter()
router.register(r'videos', ExerciseVideoViewSet, basename='exercisevideo')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
