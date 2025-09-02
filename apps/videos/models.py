# Video model for Practika MVP
import os
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings

User = get_user_model()


def video_upload_path(instance, filename):
    """Generate upload path for videos"""
    return f'videos/{instance.playlist.user.id}/{instance.playlist.id}/{filename}'


class Video(models.Model):
    """
    Video model for Practika MVP
    Students upload practice videos to their playlists
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    playlist = models.ForeignKey('playlists.Playlist', on_delete=models.CASCADE, related_name='videos')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)  # Store as list of strings
    file = models.FileField(upload_to=video_upload_path)
    duration = models.PositiveIntegerField(default=0, help_text="Duration in seconds")
    trust_score = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        help_text="Trust score based on metadata accuracy (0-100)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'videos'
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.title} (in {self.playlist.title})"
    
    def save(self, *args, **kwargs):
        """Override save to update playlist trust score"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Update playlist trust score when video is saved
        if not is_new:  # Only update if this is an existing video
            self.playlist.update_trust_score()
    
    def delete(self, *args, **kwargs):
        """Override delete to update playlist trust score"""
        playlist = self.playlist
        super().delete(*args, **kwargs)
        playlist.update_trust_score()
    
    @property
    def file_url(self):
        """Get the URL for the video file"""
        if self.file:
            return self.file.url
        return None
    
    @property
    def file_size(self):
        """Get file size in bytes"""
        if self.file and os.path.exists(self.file.path):
            return os.path.getsize(self.file.path)
        return 0
    
    @property
    def file_size_mb(self):
        """Get file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)
    
    def calculate_trust_score(self):
        """
        Calculate trust score based on metadata accuracy
        This is a simplified implementation - in production you'd use
        speech-to-text and keyword extraction
        """
        from django.conf import settings
        
        # Simple keyword matching (placeholder for actual implementation)
        title_keywords = set(self.title.lower().split())
        desc_keywords = set(self.description.lower().split()) if self.description else set()
        tag_keywords = set([tag.lower() for tag in self.tags]) if self.tags else set()
        
        # Combine all metadata keywords
        metadata_keywords = title_keywords | desc_keywords | tag_keywords
        
        # For now, return a placeholder score based on metadata completeness
        score = 0
        if self.title:
            score += 40  # Title weight
        if self.description:
            score += 30  # Description weight
        if self.tags:
            score += 30  # Tags weight
        
        return min(score, 100)  # Cap at 100
    
    def update_trust_score(self):
        """Update the trust score for this video"""
        self.trust_score = self.calculate_trust_score()
        self.save()
