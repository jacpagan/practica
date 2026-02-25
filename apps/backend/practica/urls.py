from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from videos.views import (
    SessionViewSet, ExerciseViewSet, health_check,
    register_view, login_view, me_view,
)

router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'exercises', ExerciseViewSet, basename='exercise')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/register/', register_view, name='register'),
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/me/', me_view, name='me'),
    path('health/', health_check, name='health_check'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
