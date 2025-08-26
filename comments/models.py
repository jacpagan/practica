import uuid
from django.db import models
from django.contrib.auth.models import User
from exercises.models import Exercise
from core.models import VideoAsset


class VideoComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True, null=True)
    video_asset = models.ForeignKey(VideoAsset, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "comments_videocomment"
        ordering = ['-created_at']  # Most recent first

    def __str__(self):
        return f"Comment by {self.author.username} on {self.exercise.name}"
