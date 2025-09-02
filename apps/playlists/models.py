# Playlist model for Practika MVP
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class PlaylistPrivacy(models.TextChoices):
    PUBLIC = "public", "Public"
    PRIVATE = "private", "Private"


class TrustLevel(models.TextChoices):
    BEGINNER = "beginner", "Beginner"
    ADVANCED_BEGINNER = "advanced_beginner", "Advanced Beginner"


class Playlist(models.Model):
    """
    Playlist model for Practika MVP
    Students create playlists to organize their practice videos
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='playlists')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)  # Store as list of strings
    privacy = models.CharField(
        max_length=20,
        choices=PlaylistPrivacy.choices,
        default=PlaylistPrivacy.PRIVATE,
    )
    trust_score = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        help_text="Average trust score of all videos (0-100)"
    )
    trust_level = models.CharField(
        max_length=20,
        choices=TrustLevel.choices,
        default=TrustLevel.BEGINNER,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'playlists'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} (by {self.user.email})"
    
    def update_trust_score(self):
        """Update trust score based on average of video scores"""
        videos = self.videos.all()
        if videos.exists():
            avg_score = videos.aggregate(avg=models.Avg('trust_score'))['avg']
            self.trust_score = avg_score or 0
            self.trust_level = TrustLevel.ADVANCED_BEGINNER if avg_score >= 60 else TrustLevel.BEGINNER
        else:
            self.trust_score = 0
            self.trust_level = TrustLevel.BEGINNER
        self.save()
    
    @property
    def video_count(self):
        return self.videos.count()
    
    @property
    def total_duration(self):
        """Total duration of all videos in seconds"""
        return self.videos.aggregate(total=models.Sum('duration'))['total'] or 0
