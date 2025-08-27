"""
URL configuration for practika_project project.
"""

from django.urls import path, include
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin

def home_redirect(request):
    """Redirect to exercises list - extremely minimal app"""
    return redirect('exercises:exercise_list')

def accounts_redirect(request, path=''):
    """Redirect all accounts URLs to exercises login for minimal app"""
    return redirect('exercises:login')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home_redirect, name='home'),
    path('core/', include('core.urls')),
    path('exercises/', include('exercises.urls', namespace='exercises')),
    path('comments/', include('comments.urls', namespace='comments')),
    path('accounts/', accounts_redirect, name='accounts_redirect'),
]

# Serve media files in development and production
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # In production, serve media files directly
    from django.views.static import serve
    urlpatterns += [
        path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
