"""
Video models for your personal practice tracking system.
"""

from django.db import models
from django.contrib.auth.models import User

class ExerciseVideo(models.Model):
    """Your exercise videos (like drum lessons)"""
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    video_file = models.FileField(upload_to='exercise_videos/')
    tags = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title

class PracticeThread(models.Model):
    """Your practice session videos linked to exercise videos"""
    exercise_video = models.ForeignKey(ExerciseVideo, on_delete=models.CASCADE, related_name='practice_threads')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    video_file = models.FileField(upload_to='practice_threads/')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.exercise_video.title}"
