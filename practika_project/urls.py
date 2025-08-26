"""
URL configuration for practika_project project.
"""

from django.urls import path, include
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin

def home_landing(request):
    """Show exercises list as the main page"""
    from exercises.views import exercise_list
    return exercise_list(request)

@login_required
def home_redirect(request):
    """Redirect authenticated users to exercises list"""
    return redirect('exercises:exercise_list')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home_landing, name='home'),
    path('app/', home_redirect, name='app_home'),
    path('core/', include('core.urls')),
    path('exercises/', include('exercises.urls', namespace='exercises')),
    path('comments/', include('comments.urls', namespace='comments')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
