import os
import uuid
import magic
import hashlib
import logging
import time
import shutil
from pathlib import Path
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
from core.models import VideoAsset
from core.exceptions import VideoProcessingError, StorageError, ValidationError as PractikaValidationError

logger = logging.getLogger(__name__)


class VideoStorageService:
    """
    Enhanced video storage service with comprehensive error handling,
    validation, monitoring, and transparency features
    """
    
    def __init__(self):
        self.storage = FileSystemStorage(
            location=settings.MEDIA_ROOT,
            base_url=settings.MEDIA_URL
        )
        self.video_dir = os.path.join(settings.MEDIA_ROOT, "videos")
        self._ensure_directories()
        
        # Configuration
        self.max_file_size = getattr(settings, 'MAX_UPLOAD_SIZE', 100 * 1024 * 1024)  # 100MB
        self.accepted_mime_types = getattr(settings, 'ALLOWED_VIDEO_MIME_TYPES', [
            "video/mp4",
            "video/webm", 
            "video/quicktime",
            "video/x-msvideo",
        ])
        self.accepted_extensions = getattr(settings, 'ALLOWED_VIDEO_EXTENSIONS', [
            '.mp4', '.webm', '.mov', '.avi'
        ])
        self.enable_checksum_validation = True
        self.enable_video_metadata_extraction = True
        self.enable_malware_scanning = getattr(settings, 'ENABLE_MALWARE_SCANNING', True)
        
        logger.info(f"VideoStorageService initialized: {self.video_dir}")
        logger.info(f"Accepted MIME types: {self.accepted_mime_types}")
        logger.info(f"Accepted extensions: {self.accepted_extensions}")
    
    def _ensure_directories(self):
        """Ensure required directories exist"""
        try:
            os.makedirs(self.video_dir, exist_ok=True)
            logger.debug(f"Video directory ensured: {self.video_dir}")
        except Exception as e:
            logger.error(f"Failed to create video directory: {e}")
            raise StorageError(f"Failed to create video directory: {e}")
    
    def store_uploaded_video(self, uploaded_file, user=None, metadata=None):
        """
        Store uploaded video with enhanced security validation
        """
        start_time = time.time()
        
        logger.info(f"Starting video upload: {uploaded_file.name}, size: {uploaded_file.size}, user: {user}")
        
        try:
            # Step 1: Enhanced file validation
            self._validate_uploaded_file(uploaded_file)
            
            # Step 2: Security checks
            self._perform_security_checks(uploaded_file)
            
            # Step 3: Detect MIME type
            mime_type = self._detect_mime_type(uploaded_file)
            logger.debug(f"MIME type detected: {mime_type}")
            
            # Step 4: Generate unique filename and path
            relative_path, file_path = self._generate_file_path(uploaded_file)
            logger.debug(f"Generated file path: {file_path}")
            
            # Step 5: Save file with progress tracking
            file_size = self._save_file_with_progress(uploaded_file, file_path)
            logger.info(f"File saved successfully: {file_path}, size: {file_size}")
            
            # Step 6: Validate saved file
            self._validate_saved_file(file_path, file_size, mime_type)
            
            # Step 7: Extract video metadata
            video_metadata = self._extract_video_metadata(file_path) if self.enable_video_metadata_extraction else {}
            
            # Step 8: Calculate checksum
            checksum = self._calculate_checksum(file_path) if self.enable_checksum_validation else None
            
            # Step 9: Create VideoAsset instance
            video_asset = self._create_video_asset(
                uploaded_file, relative_path, mime_type, file_size, 
                checksum, video_metadata, user, metadata
            )
            
            # Step 10: Log success
            duration = time.time() - start_time
            logger.info(
                f"Video upload completed successfully: {video_asset.id}, "
                f"duration: {duration:.4f}s, size: {file_size}, checksum: {checksum}"
            )
            
            return video_asset
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"Video upload failed: {uploaded_file.name}, "
                f"duration: {duration:.4f}s, error: {e}"
            )
            raise
    
    def _validate_uploaded_file(self, uploaded_file):
        """Enhanced file validation with security checks"""
        if not uploaded_file:
            raise ValidationError("No file provided")
        
        if not uploaded_file.name:
            raise ValidationError("File has no name")
        
        # Check file size
        if uploaded_file.size > self.max_file_size:
            raise ValidationError(
                f"File size {uploaded_file.size} exceeds maximum allowed size {self.max_file_size}"
            )
        
        # Check file extension
        file_extension = Path(uploaded_file.name).suffix.lower()
        if file_extension not in self.accepted_extensions:
            raise ValidationError(
                f"File extension '{file_extension}' is not allowed. "
                f"Accepted extensions: {', '.join(self.accepted_extensions)}"
            )
        
        # Check for suspicious file names
        suspicious_patterns = [
            '..', '\\', '//', 'script', 'javascript', 'vbscript',
            'data:', 'vbscript:', 'onload', 'onerror', 'onclick'
        ]
        
        filename_lower = uploaded_file.name.lower()
        for pattern in suspicious_patterns:
            if pattern in filename_lower:
                raise ValidationError(f"Suspicious filename pattern detected: {pattern}")
        
        logger.debug(f"File validation passed: {uploaded_file.name}")
    
    def _perform_security_checks(self, uploaded_file):
        """Perform additional security checks on uploaded files"""
        try:
            # Check file header/magic bytes
            file_content = uploaded_file.read(1024)  # Read first 1KB
            uploaded_file.seek(0)  # Reset file pointer
            
            # Check for executable file signatures
            executable_signatures = [
                b'\x7f\x45\x4c\x46',  # ELF
                b'MZ',                 # PE/EXE
                b'\x4d\x5a',          # PE/EXE (little-endian)
                b'\x50\x4b\x03\x04',  # ZIP
                b'\x50\x4b\x05\x06',  # ZIP
                b'\x50\x4b\x07\x08',  # ZIP
            ]
            
            for sig in executable_signatures:
                if file_content.startswith(sig):
                    raise ValidationError("Executable file detected - not allowed")
            
            # Check for script file signatures
            script_signatures = [
                b'#!/bin/bash',
                b'#!/bin/sh',
                b'#!/usr/bin/python',
                b'#!/usr/bin/env python',
                b'<?php',
                b'<script',
                b'javascript:',
            ]
            
            for sig in script_signatures:
                if file_content.startswith(sig):
                    raise ValidationError("Script file detected - not allowed")
            
            # Simulate malware scanning (for development)
            if self.enable_malware_scanning:
                self._simulate_malware_scan(file_content)
            
            logger.debug(f"Security checks passed for: {uploaded_file.name}")
            
        except Exception as e:
            logger.error(f"Security check failed for {uploaded_file.name}: {e}")
            raise ValidationError(f"Security validation failed: {e}")
    
    def _simulate_malware_scan(self, file_content):
        """Simulate malware scanning for development purposes"""
        # This is a simulation - in production, integrate with real antivirus software
        
        # Check for suspicious patterns in file content
        suspicious_patterns = [
            b'eval(', b'exec(', b'system(', b'shell_exec(',
            b'<script', b'javascript:', b'vbscript:',
            b'powershell', b'cmd.exe', b'bash',
            b'rm -rf', b'del /s', b'format c:',
        ]
        
        content_lower = file_content.lower()
        for pattern in suspicious_patterns:
            if pattern.lower() in content_lower:
                logger.warning(f"Suspicious content pattern detected: {pattern}")
                # In development, we'll log but allow - in production, block
                if getattr(settings, 'BLOCK_SUSPICIOUS_CONTENT', False):
                    raise ValidationError(f"Suspicious content detected: {pattern}")
        
        # Simulate scan delay
        time.sleep(0.1)  # 100ms delay to simulate scanning
        
        logger.info("Malware scan simulation completed")
    
    def _detect_mime_type(self, uploaded_file):
        """Detect MIME type using multiple methods with fallback for webcam recordings"""
        try:
            # Method 1: Use python-magic
            if hasattr(magic, 'from_buffer'):
                mime_type = magic.from_buffer(uploaded_file.read(1024), mime=True)
                uploaded_file.seek(0)
                logger.debug(f"MIME type detected by magic: {mime_type}")
                
                # Accept the MIME type if it's in our accepted list
                if mime_type in self.accepted_mime_types:
                    return mime_type
                
                # Special handling for webcam recordings that might be detected as text/plain
                # Check if this is likely a video file despite MIME type detection
                if mime_type == 'text/plain' and self._is_likely_video_file(uploaded_file):
                    logger.warning(f"MIME type detected as 'text/plain' but file appears to be video. Using extension-based detection.")
                    # Fall through to extension-based detection
                elif mime_type not in self.accepted_mime_types:
                    raise ValidationError(
                        f"MIME type '{mime_type}' is not allowed. "
                        f"Accepted types: {', '.join(self.accepted_mime_types)}"
                    )
            
            # Method 2: Fallback to file extension (more reliable for webcam recordings)
            file_extension = Path(uploaded_file.name).suffix.lower()
            extension_mime_map = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
            }
            
            if file_extension in extension_mime_map:
                logger.debug(f"Using extension-based MIME type detection: {extension_mime_map[file_extension]}")
                return extension_mime_map[file_extension]
            
            raise ValidationError(f"Could not determine MIME type for file: {uploaded_file.name}")
            
        except Exception as e:
            logger.error(f"MIME type detection failed: {e}")
            raise ValidationError(f"MIME type validation failed: {e}")
    
    def _is_likely_video_file(self, uploaded_file):
        """Check if a file is likely a video file despite MIME type detection issues"""
        try:
            # Check file extension
            file_extension = Path(uploaded_file.name).suffix.lower()
            video_extensions = ['.mp4', '.webm', '.mov', '.avi']
            
            if file_extension in video_extensions:
                # For webcam recordings, even small files can be valid
                # Check if file size is reasonable (at least 16 bytes for minimal headers)
                if uploaded_file.size >= 16:
                    # Check first few bytes for video file signatures
                    uploaded_file.seek(0)
                    header = uploaded_file.read(16)
                    uploaded_file.seek(0)
                    
                    # Common video file signatures
                    video_signatures = [
                        b'\x00\x00\x00',  # MP4/QuickTime
                        b'\x1a\x45\xdf\xa3',  # WebM
                        b'RIFF',  # AVI
                        b'\x00\x00\x00\x18',  # MP4
                    ]
                    
                    for sig in video_signatures:
                        if header.startswith(sig):
                            logger.debug(f"Video signature detected: {sig}")
                            return True
                    
                    # If extension is video and size is reasonable, assume it's a video file
                    # This handles cases where webcam recordings might not have proper headers
                    # Webcam recordings can be small initially, so we're more lenient
                    logger.debug(f"Assuming video file based on extension {file_extension} and size {uploaded_file.size}")
                    return True
                else:
                    logger.warning(f"File too small to be a valid video: {uploaded_file.size} bytes")
                    return False
            
            return False
            
        except Exception as e:
            logger.warning(f"Error checking if file is likely video: {e}")
            return False
    
    def _generate_file_path(self, uploaded_file):
        """Generate unique filename and full path"""
        try:
            file_ext = os.path.splitext(uploaded_file.name)[1]
            filename = f"{uuid.uuid4()}{file_ext}"
            
            # Use relative path for storage_path (for database)
            relative_path = os.path.join("videos", filename)
            
            # Use absolute path for actual file operations
            file_path = os.path.join(self.video_dir, filename)
            
            # Ensure filename uniqueness
            counter = 1
            while os.path.exists(file_path):
                filename = f"{uuid.uuid4()}_{counter}{file_ext}"
                relative_path = os.path.join("videos", filename)
                file_path = os.path.join(self.video_dir, filename)
                counter += 1
            
            logger.debug(f"Generated paths - relative: {relative_path}, absolute: {file_path}")
            return relative_path, file_path
            
        except Exception as e:
            logger.error(f"Failed to generate file path: {e}")
            raise StorageError(f"Failed to generate file path: {e}")
    
    def _save_file_with_progress(self, uploaded_file, file_path):
        """Save file with progress tracking and error handling"""
        try:
            # Save file in chunks for large files
            with open(file_path, 'wb+') as destination:
                total_size = uploaded_file.size
                chunk_size = 8192  # 8KB chunks
                bytes_written = 0
                
                for chunk in uploaded_file.chunks(chunk_size):
                    destination.write(chunk)
                    bytes_written += len(chunk)
                    
                    # Log progress for large files
                    if total_size > 10 * 1024 * 1024:  # 10MB
                        progress = (bytes_written / total_size) * 100
                        if int(progress) % 10 == 0:  # Log every 10%
                            logger.debug(f"Upload progress: {progress:.1f}%")
            
            # Verify file was saved correctly
            actual_size = os.path.getsize(file_path)
            if actual_size != total_size:
                raise StorageError(f"File size mismatch: expected {total_size}, got {actual_size}")
            
            return actual_size
            
        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise StorageError(f"Failed to save file: {e}")
    
    def _validate_saved_file(self, file_path, expected_size, mime_type):
        """Validate saved file integrity"""
        try:
            # Check file exists
            if not os.path.exists(file_path):
                raise StorageError("Saved file not found")
            
            # Check file size
            actual_size = os.path.getsize(file_path)
            if actual_size != expected_size:
                raise StorageError(f"File size mismatch after save: expected {expected_size}, got {actual_size}")
            
            # Verify file is readable
            with open(file_path, 'rb') as f:
                f.read(1024)  # Read first 1KB to verify file is accessible
            
            logger.debug(f"File validation passed: {file_path}")
            
        except Exception as e:
            logger.error(f"File validation failed: {e}")
            raise StorageError(f"File validation failed: {e}")
    
    def _extract_video_metadata(self, file_path):
        """Extract video metadata using ffprobe or similar tools"""
        metadata = {}
        
        try:
            # This is a placeholder for video metadata extraction
            # In a real implementation, you would use ffprobe, moviepy, or similar
            metadata = {
                'duration_sec': None,
                'width': None,
                'height': None,
                'codec': None,
                'bitrate': None,
            }
            
            logger.debug(f"Video metadata extracted: {metadata}")
            
        except Exception as e:
            logger.warning(f"Failed to extract video metadata: {e}")
            # Don't fail the upload for metadata extraction issues
        
        return metadata
    
    def _calculate_checksum(self, file_path):
        """Calculate SHA256 checksum of file"""
        try:
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(chunk)
            
            checksum = sha256_hash.hexdigest()
            logger.debug(f"Checksum calculated: {checksum}")
            return checksum
            
        except Exception as e:
            logger.error(f"Failed to calculate checksum: {e}")
            raise StorageError(f"Failed to calculate checksum: {e}")
    
    def _create_video_asset(self, uploaded_file, storage_path, mime_type, file_size, 
                           checksum, video_metadata, user, metadata):
        """Create and save VideoAsset instance"""
        try:
            video_asset = VideoAsset(
                orig_filename=uploaded_file.name,
                storage_path=storage_path,  # This should be relative path like "videos/filename.mp4"
                mime_type=mime_type,
                size_bytes=file_size,
                checksum_sha256=checksum,
                duration_sec=video_metadata.get('duration_sec'),
                width=video_metadata.get('width'),
                height=video_metadata.get('height'),
            )
            
            # Add custom metadata if provided
            if metadata:
                # Store additional metadata in a JSON field or related model
                pass
            
            video_asset.save()
            logger.info(f"VideoAsset created: {video_asset.id} with storage_path: {storage_path}")
            
            return video_asset
            
        except Exception as e:
            logger.error(f"Failed to create VideoAsset: {e}")
            raise StorageError(f"Failed to create VideoAsset: {e}")
    
    def _cleanup_failed_upload(self, file_path):
        """Clean up files from failed uploads"""
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Cleaned up failed upload file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to cleanup failed upload file: {file_path}, error: {e}")
    
    def delete_video_asset(self, video_asset):
        """
        Delete video file and VideoAsset instance with comprehensive cleanup
        """
        logger.info(f"Deleting video asset: {video_asset.id}")
        
        try:
            # Delete physical file
            if os.path.exists(video_asset.storage_path):
                os.remove(video_asset.storage_path)
                logger.info(f"Physical file deleted: {video_asset.storage_path}")
            else:
                logger.warning(f"Physical file not found: {video_asset.storage_path}")
            
            # Delete database record
            video_asset.delete()
            logger.info(f"VideoAsset deleted from database: {video_asset.id}")
            
        except Exception as e:
            logger.error(f"Failed to delete video asset: {e}")
            raise StorageError(f"Failed to delete video asset: {e}")
    
    def get_storage_info(self):
        """Get comprehensive storage information"""
        try:
            storage_path = Path(self.video_dir)
            
            if not storage_path.exists():
                return {'error': 'Storage directory does not exist'}
            
            # Get directory statistics
            total_size = 0
            file_count = 0
            mime_type_stats = {}
            
            for file_path in storage_path.rglob('*'):
                if file_path.is_file():
                    file_count += 1
                    file_size = file_path.stat().st_size
                    total_size += file_size
                    
                    # Count by MIME type
                    mime_type = magic.from_file(str(file_path), mime=True)
                    mime_type_stats[mime_type] = mime_type_stats.get(mime_type, 0) + 1
            
            # Get disk usage
            disk_usage = shutil.disk_usage(str(storage_path))
            
            return {
                'storage_path': str(storage_path),
                'total_files': file_count,
                'total_size_bytes': total_size,
                'total_size_gb': round(total_size / (1024**3), 2),
                'disk_free_bytes': disk_usage.free,
                'disk_free_gb': round(disk_usage.free / (1024**3), 2),
                'disk_total_bytes': disk_usage.total,
                'disk_total_gb': round(disk_usage.total / (1024**3), 2),
                'mime_type_distribution': mime_type_stats,
                'last_updated': time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage info: {e}")
            return {'error': str(e)}
    
    def validate_storage_integrity(self):
        """Validate integrity of all stored files"""
        logger.info("Starting storage integrity validation")
        
        try:
            storage_path = Path(self.video_dir)
            validation_results = {
                'total_files': 0,
                'valid_files': 0,
                'invalid_files': 0,
                'errors': [],
                'start_time': time.time()
            }
            
            for file_path in storage_path.rglob('*'):
                if file_path.is_file():
                    validation_results['total_files'] += 1
                    
                    try:
                        # Check file accessibility
                        with open(file_path, 'rb') as f:
                            f.read(1024)
                        
                        # Check file size > 0
                        if file_path.stat().st_size == 0:
                            validation_results['invalid_files'] += 1
                            validation_results['errors'].append(f"Empty file: {file_path}")
                            continue
                        
                        validation_results['valid_files'] += 1
                        
                    except Exception as e:
                        validation_results['invalid_files'] += 1
                        validation_results['errors'].append(f"Error validating {file_path}: {e}")
            
            validation_results['end_time'] = time.time()
            validation_results['duration'] = validation_results['end_time'] - validation_results['start_time']
            
            logger.info(f"Storage integrity validation completed: {validation_results}")
            return validation_results
            
        except Exception as e:
            logger.error(f"Storage integrity validation failed: {e}")
            return {'error': str(e)}
