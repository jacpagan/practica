"""URLs for legacy HTML-era video views."""

from django.urls import path
from . import views

urlpatterns = [
    path('', views.video_list, name='video_list'),
    path('upload/', views.upload_exercise_video, name='upload_video'),
    path('video/<int:video_id>/', views.video_detail, name='video_detail'),
    path('video/<int:video_id>/upload-thread/', views.upload_practice_thread, name='upload_thread'),
]
