"""
URLs for your personal practice tracking system.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('test/', views.test_view, name='test'),
    path('', views.video_list, name='video_list'),
    path('upload/', views.upload_exercise_video, name='upload_video'),
    path('video/<int:video_id>/', views.video_detail, name='video_detail'),
    path('video/<int:video_id>/upload-thread/', views.upload_practice_thread, name='upload_thread'),
]
