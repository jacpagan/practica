from django.urls import path, include
from rest_framework.routers import DefaultRouter
from comments.views import VideoCommentViewSet, add_comment, edit_comment, delete_comment

app_name = 'comments'

router = DefaultRouter()
router.register(r'video-comments', VideoCommentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('add/<uuid:exercise_id>/', add_comment, name='add_comment'),
    path('edit/<uuid:comment_id>/', edit_comment, name='edit_comment'),
    path('delete/<uuid:comment_id>/', delete_comment, name='delete_comment'),
]
