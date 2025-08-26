import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

class VideoAsset(models.Model):
    """
    VideoAsset model for video storage and management
    """
    
    # Core fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    orig_filename = models.CharField(max_length=255, help_text="Original filename as uploaded")
    storage_path = models.CharField(max_length=500, help_text="Full path to stored video file")
    mime_type = models.CharField(max_length=100, help_text="MIME type of the video")
    size_bytes = models.PositiveIntegerField(help_text="File size in bytes")
    checksum_sha256 = models.CharField(max_length=64, help_text="SHA256 checksum for integrity verification")
    poster_path = models.CharField(max_length=500, blank=True, null=True, help_text="Path to video poster image")
    
    # Video metadata
    duration_sec = models.PositiveIntegerField(blank=True, null=True, help_text="Video duration in seconds")
    width = models.PositiveIntegerField(blank=True, null=True, help_text="Video width in pixels")
    height = models.PositiveIntegerField(blank=True, null=True, help_text="Video height in pixels")
    
    # Processing status
    processing_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending',
        help_text="Current processing status of the video"
    )
    processing_error = models.TextField(blank=True, null=True, help_text="Error message if processing failed")
    processed_at = models.DateTimeField(blank=True, null=True, help_text="When processing was completed")
    
    # Validation and access tracking
    is_valid = models.BooleanField(default=True, help_text="Whether the asset passed integrity checks")
    last_validated = models.DateTimeField(blank=True, null=True, help_text="When the asset was last validated")
    validation_errors = models.JSONField(blank=True, default=list, help_text="List of validation errors found")
    access_count = models.PositiveIntegerField(default=0, help_text="Number of times this asset was accessed")
    last_accessed = models.DateTimeField(blank=True, null=True, help_text="Last time this asset was accessed")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, help_text="When the asset was created")
    updated_at = models.DateTimeField(auto_now=True, help_text="When the asset was last updated")

    class Meta:
        db_table = "core_videoasset"
        verbose_name = "Video Asset"
        verbose_name_plural = "Video Assets"
        indexes = [
            models.Index(fields=['mime_type']),
            models.Index(fields=['processing_status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.orig_filename} ({self.id})"

    def clean(self):
        """Basic validation for the model"""
        super().clean()
        
        # Validate file size
        if self.size_bytes and self.size_bytes <= 0:
            raise ValidationError("File size must be greater than 0")
        
        # MIME type validation is handled during upload

    def save(self, *args, **kwargs):
        """Override save method with basic validation"""
        # Validate before saving
        self.full_clean()
        
        # Call parent save
        super().save(*args, **kwargs)

    def get_public_url(self):
        """Get public URL for the video asset"""
        try:
            # Use dependency injection container to get URL provider
            from core.container import container
            url_provider = container.get_url_provider()
            return url_provider.get_video_url(self)
        except Exception as e:
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to get public URL for video asset {self.id}: {e}")
            # Fallback: return storage path
            return self.storage_path
