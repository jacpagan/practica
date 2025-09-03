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
    storage_path = models.CharField(max_length=500, blank=True, null=True, help_text="Full path to stored video file")
    mime_type = models.CharField(max_length=100, help_text="MIME type of the video")
    size_bytes = models.PositiveIntegerField(blank=True, null=True, help_text="File size in bytes")
    checksum_sha256 = models.CharField(max_length=64, blank=True, null=True, help_text="SHA256 checksum for integrity verification")
    poster_path = models.CharField(max_length=500, blank=True, null=True, help_text="Path to video poster image")
    renditions = models.JSONField(default=dict, blank=True, help_text="Mapping of quality labels to rendition URLs")
    
    # YouTube support
    youtube_url = models.URLField(blank=True, null=True, help_text="YouTube video URL")
    video_type = models.CharField(
        max_length=20,
        choices=[
            ('upload', 'Upload'),
            ('recorded', 'Recorded'),
            ('youtube', 'YouTube'),
        ],
        default='upload',
        help_text="Type of video source"
    )

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
        
        # Validate MIME type
        if self.mime_type:
            valid_mime_types = [
                'video/mp4', 'video/webm', 'video/ogg', 'video/avi',
                'video/mov', 'video/wmv', 'video/flv', 'video/mkv'
            ]
            if self.mime_type not in valid_mime_types:
                raise ValidationError(f"Unsupported MIME type: {self.mime_type}")
        
        # Validate checksum format
        if self.checksum_sha256:
            import re
            if not re.match(r'^[a-fA-F0-9]{64}$', self.checksum_sha256):
                raise ValidationError("Invalid checksum format")

    def save(self, *args, **kwargs):
        """Override save method with basic validation and auto-checksum calculation"""
        # Auto-calculate checksum if missing and we have a storage path
        if not self.checksum_sha256 and self.storage_path:
            calculated_checksum = self.calculate_checksum()
            if calculated_checksum:
                self.checksum_sha256 = calculated_checksum
        
        # Run validation
        try:
            self.full_clean()
        except ValidationError:
            # If validation fails, log it but don't crash
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Validation failed for VideoAsset {self.id}: {self.checksum_sha256}")
        
        # Call parent save
        super().save(*args, **kwargs)

    def get_public_url(self):
        """Get public URL for the video asset"""
        try:
            # Handle YouTube videos
            if self.video_type == 'youtube' and self.youtube_url:
                return self.youtube_url
            
            # Handle uploaded/recorded videos
            if self.renditions:
                return self.renditions.get('720p') or next(iter(self.renditions.values()))

            from core.container import container
            url_provider = container.get_url_provider()
            return url_provider.get_video_url(self)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to get public URL for video asset {self.id}: {e}")
            return self.storage_path or self.youtube_url
    
    def get_youtube_embed_url(self):
        """Get YouTube embed URL for the video"""
        if self.youtube_url:
            # Extract video ID from various YouTube URL formats
            import re
            patterns = [
                r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
                r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, self.youtube_url)
                if match:
                    video_id = match.group(1)
                    # Use simple embed URL without problematic parameters
                    from django.utils.safestring import mark_safe
                    return mark_safe(f"https://www.youtube.com/embed/{video_id}")
            
            return self.youtube_url
        return None
    
    def get_youtube_thumbnail_url(self):
        """Get YouTube thumbnail URL for the video"""
        if self.video_type == 'youtube' and self.youtube_url:
            embed_url = self.get_youtube_embed_url()
            if embed_url:
                video_id = embed_url.split('/')[-1]
                return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        return None

    def validate_integrity(self):
        """Validate the integrity of the video asset"""
        import re
        from django.utils import timezone
        
        errors = []
        warnings = []
        
        # Check if checksum exists
        if not self.checksum_sha256:
            errors.append("Missing checksum")
        else:
            # Validate checksum format
            if not re.match(r'^[a-fA-F0-9]{64}$', self.checksum_sha256):
                errors.append("Invalid checksum format")
        
        # Check file size
        if self.size_bytes and self.size_bytes <= 0:
            errors.append("Invalid file size")
        
        # Check MIME type
        if self.mime_type:
            valid_mime_types = [
                'video/mp4', 'video/webm', 'video/ogg', 'video/avi',
                'video/mov', 'video/wmv', 'video/flv', 'video/mkv'
            ]
            if self.mime_type not in valid_mime_types:
                warnings.append(f"Unsupported MIME type: {self.mime_type}")
        
        # Check processing status
        if self.processing_status == 'failed':
            warnings.append("Video processing failed")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'timestamp': timezone.now().isoformat()
        }

    def calculate_checksum(self):
        """Calculate SHA256 checksum for the video file"""
        import hashlib
        import os
        
        if not self.storage_path or not os.path.exists(self.storage_path):
            return None
        
        try:
            with open(self.storage_path, 'rb') as f:
                sha256_hash = hashlib.sha256()
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
                return sha256_hash.hexdigest()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to calculate checksum for {self.storage_path}: {e}")
            return None


class VideoClip(models.Model):
    """
    VideoClip model for storing cropped video segments with idempotency
    """
    
    # Core fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_video = models.ForeignKey(VideoAsset, on_delete=models.CASCADE, related_name='clips')
    clip_hash = models.CharField(max_length=64, unique=True, help_text="SHA256 hash of clip selection for idempotency")
    
    # Clip parameters
    start_time = models.FloatField(help_text="Start time in seconds")
    end_time = models.FloatField(help_text="End time in seconds")
    duration = models.FloatField(help_text="Duration in seconds")
    
    # Storage
    storage_path = models.CharField(max_length=500, help_text="Path to cropped video file")
    size_bytes = models.PositiveIntegerField(blank=True, null=True, help_text="File size in bytes")
    
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
        help_text="Current processing status of the clip"
    )
    processing_error = models.TextField(blank=True, null=True, help_text="Error message if processing failed")
    processed_at = models.DateTimeField(blank=True, null=True, help_text="When processing was completed")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, help_text="When the clip was created")
    updated_at = models.DateTimeField(auto_now=True, help_text="When the clip was last updated")

    class Meta:
        db_table = "core_videoclip"
        verbose_name = "Video Clip"
        verbose_name_plural = "Video Clips"
        indexes = [
            models.Index(fields=['clip_hash']),
            models.Index(fields=['original_video', 'start_time', 'end_time']),
            models.Index(fields=['processing_status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Clip {self.id} from {self.original_video.orig_filename} ({self.start_time}s-{self.end_time}s)"

    def save(self, *args, **kwargs):
        """Override save to calculate duration and ensure idempotency"""
        if not self.duration:
            self.duration = self.end_time - self.start_time
        
        # Ensure clip_hash is set for idempotency
        if not self.clip_hash:
            from core.services.video_processor import video_processor_service
            self.clip_hash = video_processor_service.generate_clip_hash(
                self.original_video, self.start_time, self.end_time
            )
        
        super().save(*args, **kwargs)

    def get_public_url(self):
        """Get public URL for the video clip"""
        try:
            from core.container import container
            url_provider = container.get_url_provider()
            return url_provider.get_video_url(self)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to get public URL for video clip {self.id}: {e}")
            return self.storage_path
