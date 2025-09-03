"""
Video application service - Orchestrates video domain operations
"""

import uuid
from typing import List, Optional
from django.db import transaction

from ...domain.entities import VideoAsset
from ...domain.value_objects import FileInfo, VideoMetadata
from ...domain.domain_services import VideoProcessingService
from ...ports.outbound.repository_ports import VideoAssetRepository
from ...ports.outbound.video_storage_port import VideoStoragePort
from ...ports.outbound.notification_port import NotificationPort
from ...ports.outbound.audit_logger_port import AuditLoggerPort


class VideoApplicationService:
    """
    Application service for video operations
    Orchestrates domain operations and coordinates with external systems
    """
    
    def __init__(
        self,
        video_asset_repository: VideoAssetRepository,
        video_storage_port: VideoStoragePort,
        notification_port: NotificationPort,
        audit_logger: AuditLoggerPort
    ):
        self.video_asset_repository = video_asset_repository
        self.video_storage_port = video_storage_port
        self.notification_port = notification_port
        self.audit_logger = audit_logger
        
        # Create domain service (would be injected in real implementation)
        self.video_processing_service = VideoProcessingService(None)  # VideoProcessor would be injected
    
    @transaction.atomic
    def upload_video(self, video_file) -> VideoAsset:
        """
        Upload video and create VideoAsset
        Orchestrates the complete workflow
        """
        try:
            # Create FileInfo from uploaded file
            file_info = FileInfo.create_from_file(video_file, video_file.content_type)
            
            # Validate file
            if not file_info.is_video():
                raise ValueError("File must be a video")
            
            if not file_info.is_valid_size():
                raise ValueError("File size exceeds maximum allowed size")
            
            # Generate storage path
            storage_path = f"videos/{uuid.uuid4()}.{file_info.extension}"
            
            # Store video file
            actual_storage_path = self.video_storage_port.store_video(video_file, storage_path)
            
            # Create VideoAsset domain entity
            video_asset = VideoAsset.create_from_upload(file_info, actual_storage_path)
            
            # Save VideoAsset
            video_asset = self.video_asset_repository.save(video_asset)
            
            # Publish domain events
            self._publish_domain_events(video_asset)
            
            # Log successful upload
            self.audit_logger.log_system_event(
                "video_uploaded",
                "VideoApplicationService",
                {
                    "video_id": str(video_asset.id),
                    "filename": file_info.original_filename,
                    "size_bytes": file_info.size_bytes
                }
            )
            
            return video_asset
            
        except Exception as e:
            # Log error
            self.audit_logger.log_system_event(
                "video_upload_failed",
                "VideoApplicationService",
                {"error": str(e), "filename": getattr(video_file, 'name', 'unknown')}
            )
            raise
    
    def get_video(self, video_id: uuid.UUID) -> VideoAsset:
        """
        Get video by ID
        """
        try:
            video_asset = self.video_asset_repository.find_by_id(video_id)
            if not video_asset:
                raise ValueError("Video not found")
            
            # Record access
            video_asset.record_access()
            video_asset = self.video_asset_repository.save(video_asset)
            
            return video_asset
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_access_failed",
                "VideoApplicationService",
                {"error": str(e), "video_id": str(video_id)}
            )
            raise
    
    def start_processing(self, video_id: uuid.UUID) -> str:
        """
        Start video processing
        """
        try:
            video_asset = self.video_asset_repository.find_by_id(video_id)
            if not video_asset:
                raise ValueError("Video not found")
            
            # Start processing
            processing_job_id = self.video_processing_service.start_processing(video_asset)
            
            # Save updated video asset
            video_asset = self.video_asset_repository.save(video_asset)
            
            # Publish domain events
            self._publish_domain_events(video_asset)
            
            # Log processing start
            self.audit_logger.log_system_event(
                "video_processing_started",
                "VideoApplicationService",
                {
                    "video_id": str(video_id),
                    "processing_job_id": processing_job_id
                }
            )
            
            return processing_job_id
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_processing_start_failed",
                "VideoApplicationService",
                {"error": str(e), "video_id": str(video_id)}
            )
            raise
    
    def complete_processing(self, video_id: uuid.UUID, video_metadata: VideoMetadata, poster_path: str) -> None:
        """
        Complete video processing
        """
        try:
            video_asset = self.video_asset_repository.find_by_id(video_id)
            if not video_asset:
                raise ValueError("Video not found")
            
            # Complete processing
            self.video_processing_service.complete_processing(video_asset, video_asset.storage_path)
            
            # Save updated video asset
            video_asset = self.video_asset_repository.save(video_asset)
            
            # Publish domain events
            self._publish_domain_events(video_asset)
            
            # Log processing completion
            self.audit_logger.log_system_event(
                "video_processing_completed",
                "VideoApplicationService",
                {
                    "video_id": str(video_id),
                    "duration_sec": video_metadata.duration_sec,
                    "resolution": video_metadata.resolution
                }
            )
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_processing_completion_failed",
                "VideoApplicationService",
                {"error": str(e), "video_id": str(video_id)}
            )
            raise
    
    def fail_processing(self, video_id: uuid.UUID, error_message: str, error_code: str = None) -> None:
        """
        Fail video processing
        """
        try:
            video_asset = self.video_asset_repository.find_by_id(video_id)
            if not video_asset:
                raise ValueError("Video not found")
            
            # Fail processing
            self.video_processing_service.fail_processing(video_asset, error_message, error_code)
            
            # Save updated video asset
            video_asset = self.video_asset_repository.save(video_asset)
            
            # Publish domain events
            self._publish_domain_events(video_asset)
            
            # Log processing failure
            self.audit_logger.log_system_event(
                "video_processing_failed",
                "VideoApplicationService",
                {
                    "video_id": str(video_id),
                    "error_message": error_message,
                    "error_code": error_code
                }
            )
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_processing_failure_handling_failed",
                "VideoApplicationService",
                {"error": str(e), "video_id": str(video_id)}
            )
            raise
    
    def get_video_url(self, video_id: uuid.UUID) -> str:
        """
        Get public URL for video
        """
        try:
            video_asset = self.video_asset_repository.find_by_id(video_id)
            if not video_asset:
                raise ValueError("Video not found")
            
            # Get URL from storage
            url = self.video_storage_port.get_video_url(video_asset.storage_path)
            
            # Record access
            video_asset.record_access()
            self.video_asset_repository.save(video_asset)
            
            return url
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_url_generation_failed",
                "VideoApplicationService",
                {"error": str(e), "video_id": str(video_id)}
            )
            raise
    
    @transaction.atomic
    def delete_video(self, video_id: uuid.UUID) -> None:
        """
        Delete video
        """
        try:
            video_asset = self.video_asset_repository.find_by_id(video_id)
            if not video_asset:
                raise ValueError("Video not found")
            
            # Check if video can be deleted
            if not video_asset.can_be_deleted():
                raise ValueError("Video cannot be deleted in current state")
            
            # Delete from storage
            self.video_storage_port.delete_video(video_asset.storage_path)
            
            # Delete from repository
            self.video_asset_repository.delete(video_id)
            
            # Log deletion
            self.audit_logger.log_system_event(
                "video_deleted",
                "VideoApplicationService",
                {"video_id": str(video_id)}
            )
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_deletion_failed",
                "VideoApplicationService",
                {"error": str(e), "video_id": str(video_id)}
            )
            raise
    
    def list_videos(self) -> List[VideoAsset]:
        """
        List all videos
        """
        try:
            videos = self.video_asset_repository.find_all()
            
            # Log access
            self.audit_logger.log_system_event(
                "videos_listed",
                "VideoApplicationService",
                {"count": len(videos)}
            )
            
            return videos
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "video_listing_failed",
                "VideoApplicationService",
                {"error": str(e)}
            )
            raise
    
    def _publish_domain_events(self, video_asset: VideoAsset) -> None:
        """
        Publish domain events from video asset
        """
        events = video_asset.get_domain_events()
        for event in events:
            # Here you would publish to an event bus
            # For now, we'll just log the event
            self.audit_logger.log_system_event(
                "domain_event",
                "VideoApplicationService",
                {"event_type": event.event_type, "aggregate_id": str(event.aggregate_id)}
            )
        
        # Clear events after publishing
        video_asset.clear_domain_events()
