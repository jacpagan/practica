import uuid
import hashlib
import os
import logging
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from pathlib import Path

logger = logging.getLogger(__name__)


class VideoAsset(models.Model):
    """
    Enhanced VideoAsset model with comprehensive validation,
    monitoring, and transparency features
    """
    
    # Core fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    orig_filename = models.CharField(max_length=255, help_text="Original filename as uploaded")
    storage_path = models.CharField(max_length=500, help_text="Full path to stored video file")
    mime_type = models.CharField(max_length=100, help_text="MIME type of the video")
    size_bytes = models.PositiveIntegerField(help_text="File size in bytes")
    checksum_sha256 = models.CharField(max_length=64, help_text="SHA256 checksum for integrity verification")
    
    # Video metadata
    duration_sec = models.PositiveIntegerField(null=True, blank=True, help_text="Video duration in seconds")
    width = models.PositiveIntegerField(null=True, blank=True, help_text="Video width in pixels")
    height = models.PositiveIntegerField(null=True, blank=True, help_text="Video height in pixels")
    poster_path = models.CharField(max_length=500, null=True, blank=True, help_text="Path to video poster image")
    
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
    processed_at = models.DateTimeField(null=True, blank=True, help_text="When processing was completed")
    
    # Usage tracking
    access_count = models.PositiveIntegerField(default=0, help_text="Number of times this asset was accessed")
    last_accessed = models.DateTimeField(null=True, blank=True, help_text="Last time this asset was accessed")
    
    # Validation and integrity
    is_valid = models.BooleanField(default=True, help_text="Whether the asset passed integrity checks")
    validation_errors = models.JSONField(default=list, blank=True, help_text="List of validation errors found")
    last_validated = models.DateTimeField(null=True, blank=True, help_text="When the asset was last validated")

    class Meta:
        db_table = "core_videoasset"
        verbose_name = "Video Asset"
        verbose_name_plural = "Video Assets"
        indexes = [
            models.Index(fields=['mime_type']),
            models.Index(fields=['processing_status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['is_valid']),
        ]

    def __str__(self):
        return f"{self.orig_filename} ({self.id})"

    def clean(self):
        """Custom validation for the model"""
        super().clean()
        
        # Validate file size
        if self.size_bytes and self.size_bytes <= 0:
            raise ValidationError("File size must be greater than 0")
        
        # Validate MIME type
        if self.mime_type and self.mime_type not in getattr(settings, 'ACCEPTED_VIDEO_MIME_TYPES', []):
            raise ValidationError(f"Unsupported MIME type: {self.mime_type}")
        
        # Validate checksum format
        if self.checksum_sha256 and len(self.checksum_sha256) != 64:
            raise ValidationError("Checksum must be 64 characters long (SHA256)")

    def save(self, *args, **kwargs):
        """Override save method to add validation and logging"""
        # Set checksum if not provided
        if not self.checksum_sha256 and self.storage_path:
            self.checksum_sha256 = self._calculate_checksum()
        
        # Validate before saving
        self.full_clean()
        
        # Log the save operation
        logger.info(f"Saving VideoAsset: {self.id}, status: {self.processing_status}")
        
        super().save(*args, **kwargs)
        
        # Post-save operations
        self._post_save_operations()

    def _calculate_checksum(self):
        """Calculate SHA256 checksum of the video file"""
        if not self.storage_path or not os.path.exists(self.storage_path):
            logger.warning(f"Cannot calculate checksum: file not found at {self.storage_path}")
            return "0" * 64
        
        try:
            sha256_hash = hashlib.sha256()
            with open(self.storage_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            
            checksum = sha256_hash.hexdigest()
            logger.debug(f"Calculated checksum for {self.id}: {checksum}")
            return checksum
            
        except Exception as e:
            logger.error(f"Failed to calculate checksum for {self.id}: {e}")
            return "0" * 64

    def _post_save_operations(self):
        """Operations to perform after saving"""
        try:
            # Update processing status if metadata is available
            if self.duration_sec and self.width and self.height and self.processing_status == 'pending':
                self.processing_status = 'completed'
                self.processed_at = timezone.now()
                self.save(update_fields=['processing_status', 'processed_at'])
                logger.info(f"VideoAsset {self.id} marked as completed")
                
        except Exception as e:
            logger.error(f"Post-save operations failed for {self.id}: {e}")

    def validate_integrity(self):
        """Validate the integrity of the stored video file"""
        validation_results = {
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'timestamp': timezone.now()
        }
        
        try:
            # Check if file exists
            if not os.path.exists(self.storage_path):
                validation_results['is_valid'] = False
                validation_results['errors'].append("File not found on disk")
                return validation_results
            
            # Check file size
            actual_size = os.path.getsize(self.storage_path)
            if actual_size != self.size_bytes:
                validation_results['is_valid'] = False
                validation_results['errors'].append(f"Size mismatch: expected {self.size_bytes}, got {actual_size}")
            
            # Check file accessibility
            try:
                with open(self.storage_path, 'rb') as f:
                    f.read(1024)  # Read first 1KB
            except Exception as e:
                validation_results['is_valid'] = False
                validation_results['errors'].append(f"File not accessible: {e}")
            
            # Verify checksum
            if self.checksum_sha256 and self.checksum_sha256 != "0" * 64:
                actual_checksum = self._calculate_checksum()
                if actual_checksum != self.checksum_sha256:
                    validation_results['is_valid'] = False
                    validation_results['errors'].append("Checksum mismatch")
            
            # Check for empty file
            if actual_size == 0:
                validation_results['is_valid'] = False
                validation_results['errors'].append("File is empty")
            
            # Update validation status
            self.is_valid = validation_results['is_valid']
            self.validation_errors = validation_results['errors']
            self.last_validated = validation_results['timestamp']
            
            # Save without triggering post-save operations
            super(VideoAsset, self).save(update_fields=['is_valid', 'validation_errors', 'last_validated'])
            
            logger.info(f"Integrity validation completed for {self.id}: {'valid' if self.is_valid else 'invalid'}")
            
        except Exception as e:
            logger.error(f"Integrity validation failed for {self.id}: {e}")
            validation_results['is_valid'] = False
            validation_results['errors'].append(f"Validation error: {e}")
        
        return validation_results

    def mark_accessed(self):
        """Mark the asset as accessed"""
        self.access_count += 1
        self.last_accessed = timezone.now()
        self.save(update_fields=['access_count', 'last_accessed'])
        logger.debug(f"VideoAsset {self.id} marked as accessed")

    def get_file_info(self):
        """Get comprehensive file information"""
        file_info = {
            'id': str(self.id),
            'filename': self.orig_filename,
            'size_bytes': self.size_bytes,
            'size_mb': round(self.size_bytes / (1024 * 1024), 2),
            'mime_type': self.mime_type,
            'checksum': self.checksum_sha256,
            'processing_status': self.processing_status,
            'is_valid': self.is_valid,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
        }
        
        # Add file system info if available
        if os.path.exists(self.storage_path):
            try:
                stat = os.stat(self.storage_path)
                file_info.update({
                    'file_exists': True,
                    'file_size_on_disk': stat.st_size,
                    'file_modified': timezone.datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    'file_permissions': oct(stat.st_mode)[-3:],
                })
            except Exception as e:
                file_info['file_error'] = str(e)
        else:
            file_info['file_exists'] = False
        
        return file_info

    def delete(self, *args, **kwargs):
        """Override delete to clean up physical files"""
        try:
            # Delete physical file
            if os.path.exists(self.storage_path):
                os.remove(self.storage_path)
                logger.info(f"Physical file deleted: {self.storage_path}")
            
            # Delete poster if exists
            if self.poster_path and os.path.exists(self.poster_path):
                os.remove(self.poster_path)
                logger.info(f"Poster file deleted: {self.poster_path}")
            
        except Exception as e:
            logger.error(f"Failed to delete physical files for {self.id}: {e}")
        
        # Call parent delete
        super().delete(*args, **kwargs)
        logger.info(f"VideoAsset {self.id} deleted from database")

    @classmethod
    def get_storage_stats(cls):
        """Get storage statistics for all video assets"""
        stats = {
            'total_assets': cls.objects.count(),
            'total_size_bytes': cls.objects.aggregate(total=models.Sum('size_bytes'))['total'] or 0,
            'total_size_gb': 0,
            'by_status': {},
            'by_mime_type': {},
            'recent_uploads': 0,
        }
        
        # Calculate GB
        stats['total_size_gb'] = round(stats['total_size_bytes'] / (1024**3), 2)
        
        # Count by status
        for status, _ in cls._meta.get_field('processing_status').choices:
            stats['by_status'][status] = cls.objects.filter(processing_status=status).count()
        
        # Count by MIME type
        mime_types = cls.objects.values_list('mime_type', flat=True).distinct()
        for mime_type in mime_types:
            stats['by_mime_type'][mime_type] = cls.objects.filter(mime_type=mime_type).count()
        
        # Recent uploads (last 24 hours)
        yesterday = timezone.now() - timezone.timedelta(days=1)
        stats['recent_uploads'] = cls.objects.filter(created_at__gte=yesterday).count()
        
        return stats
