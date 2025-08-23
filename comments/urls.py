from django.urls import path, include
from rest_framework.routers import DefaultRouter
from comments.views import VideoCommentViewSet

router = DefaultRouter()
router.register(r'video-comments', VideoCommentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
