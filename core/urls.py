from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('metrics/', views.metrics, name='metrics'),
    path('logs/', views.logs, name='logs'),
    path('test/', views.test_endpoint, name='test_endpoint'),
    path('api/upload-video/', views.upload_video, name='upload_video'),
    path('api/videos/', views.list_videos, name='list_videos'),
    path('api/videos/<uuid:video_id>/delete/', views.delete_video, name='delete_video'),
    path('upload-test/', views.upload_test_page, name='upload_test_page'),
    path('debug-settings/', views.debug_settings, name='debug_settings'),
]
