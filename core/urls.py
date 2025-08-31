from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('debug/signup/', views.signup_debug, name='signup_debug'),
    path('api/upload-video/', views.upload_video, name='upload_video'),
    path('api/videos/', views.list_videos, name='list_videos'),
    path('api/videos/<uuid:video_id>/delete/', views.delete_video, name='delete_video'),
    path('api/create-clip/', views.create_clip, name='create_clip'),
]
