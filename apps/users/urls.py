# URL configuration for Practika MVP API
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import AuthViewSet, PlaylistViewSet, VideoViewSet, AdminViewSet
from .health import health_check

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'playlists', PlaylistViewSet, basename='playlists')
router.register(r'videos', VideoViewSet, basename='videos')
router.register(r'admin', AdminViewSet, basename='admin')

urlpatterns = [
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('health/', health_check, name='health'),
]
