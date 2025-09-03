"""
URL configuration for practika_project project.
"""

from django.urls import path, include
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from exercises import views as exercise_views
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin

def home_redirect(request):
    """Redirect to exercises list - extremely minimal app"""
    return redirect('exercises:exercise_list')



urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home_redirect, name='home'),
    path('core/', include('core.urls')),
    path('exercises/', exercise_views.exercise_list, name='exercise_list'),
    path('exercises/create/', exercise_views.exercise_create, name='exercise_create'),
    path('exercises/<uuid:exercise_id>/', exercise_views.exercise_detail, name='exercise_detail'),
    path('exercises/', include('exercises.urls', namespace='exercises')),
    path('login/', exercise_views.user_login, name='login'),
    path('comments/', include('comments.urls', namespace='comments')),
    path('accounts/', include('accounts.urls', namespace='accounts')),
    
    # Top-level URL patterns for tests (aliases to namespaced URLs)
    path('exercise/create/', lambda request: redirect('exercises:exercise_create'), name='exercise_create'),
    path('exercise/<uuid:exercise_id>/', lambda request, exercise_id: redirect('exercises:exercise_detail', exercise_id=exercise_id), name='exercise_detail'),
    path('exercise/list/', lambda request: redirect('exercises:exercise_list'), name='exercise_list'),
]

# Serve media files in development and production
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    # In production, serve media and static files directly
    from django.views.static import serve
    from django.contrib.staticfiles.views import serve as static_serve
    
    urlpatterns += [
        path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
        # Use Django's built-in static file serving for better compatibility
        path('static/<path:path>', static_serve, {'insecure': True}),
    ]
