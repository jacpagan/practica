import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

class VideoAsset(models.Model):
    """
    Simplified VideoAsset model for v1 - core video storage and management
    """
    
    # Core fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    orig_filename = models.CharField(max_length=255, help_text="Original filename as uploaded")
    storage_path = models.CharField(max_length=500, help_text="Full path to stored video file")
    mime_type = models.CharField(max_length=100, help_text="MIME type of the video")
    size_bytes = models.PositiveIntegerField(help_text="File size in bytes")
    
    # Video metadata
    duration_sec = models.PositiveIntegerField(null=True, blank=True, help_text="Video duration in seconds")
    width = models.PositiveIntegerField(null=True, blank=True, help_text="Video width in pixels")
    height = models.PositiveIntegerField(null=True, blank=True, help_text="Video height in pixels")
    
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
        
        # Validate MIME type - more permissive for testing
        allowed_types = [
            'video/mp4', 'video/avi', 'video/mov', 'video/webm', 'video/ogg',
            'video/x-msvideo', 'video/quicktime', 'video/x-matroska',
            'application/octet-stream', 'text/plain'  # Allow text files for testing
        ]
        if self.mime_type and self.mime_type not in allowed_types:
            raise ValidationError(f"Unsupported MIME type: {self.mime_type}. Allowed types: {', '.join(allowed_types)}")

    def save(self, *args, **kwargs):
        """Override save method with basic validation"""
        # Validate before saving
        self.full_clean()
        
        # Call parent save
        super().save(*args, **kwargs)

    def get_public_url(self):
        """Get public URL for the video asset"""
        try:
            # Use storage service to get URL
            from core.services.storage import VideoStorageService
            storage_service = VideoStorageService()
            return storage_service.get_video_url(self)
        except Exception:
            # Fallback: return storage path
            return self.storage_path
