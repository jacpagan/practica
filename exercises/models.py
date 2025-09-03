import uuid
from django.db import models
from django.contrib.auth import get_user_model
from core.models import VideoAsset

User = get_user_model()


class Exercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True, null=True)
    video_asset = models.ForeignKey(VideoAsset, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exercises_exercise"
        unique_together = ["name", "created_by"]

    def __str__(self):
        return f"{self.name} by {self.created_by.username}"
