"""
Exercise application service - Orchestrates exercise domain operations
"""

import uuid
from typing import List, Optional
from django.db import transaction

from ...domain.entities import Exercise
from ...domain.value_objects import UserId
from ...domain.domain_services import ExerciseManagementService
from ...ports.outbound.repository_ports import ExerciseRepository, VideoAssetRepository
from ...ports.outbound.notification_port import NotificationPort
from ...ports.outbound.audit_logger_port import AuditLoggerPort


class ExerciseApplicationService:
    """
    Application service for exercise operations
    Orchestrates domain operations and coordinates with external systems
    """
    
    def __init__(
        self,
        exercise_repository: ExerciseRepository,
        video_asset_repository: VideoAssetRepository,
        notification_port: NotificationPort,
        audit_logger: AuditLoggerPort
    ):
        self.exercise_repository = exercise_repository
        self.video_asset_repository = video_asset_repository
        self.notification_port = notification_port
        self.audit_logger = audit_logger
        
        # Create domain service
        self.exercise_management_service = ExerciseManagementService(
            exercise_repository, video_asset_repository
        )
    
    @transaction.atomic
    def create_exercise(self, name: str, description: str, video_file, user_id: UserId) -> Exercise:
        """
        Create exercise with video upload
        Orchestrates the complete workflow
        """
        try:
            # Log audit event
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="create_exercise",
                resource_type="exercise",
                resource_id="pending",
                details={"name": name}
            )
            
            # Validate user can create exercises
            if not self.exercise_management_service.can_user_create_exercise(user_id):
                raise ValueError("User is not authorized to create exercises")
            
            # Validate exercise data
            validation_errors = self.exercise_management_service.validate_exercise_data(name, description)
            if validation_errors:
                raise ValueError(f"Validation errors: {', '.join(validation_errors)}")
            
            # Upload video and create VideoAsset
            from .video_application_service import VideoApplicationService
            video_application_service = VideoApplicationService(
                self.video_asset_repository,
                self.notification_port,
                self.audit_logger
            )
            
            video_asset = video_application_service.upload_video(video_file)
            
            # Create exercise
            exercise = self.exercise_management_service.create_exercise(
                name, description, video_asset.id, user_id
            )
            
            # Save exercise
            exercise = self.exercise_repository.save(exercise)
            
            # Publish domain events
            self._publish_domain_events(exercise)
            
            # Send notification
            self.notification_port.log_event(
                "exercise_created",
                {
                    "exercise_id": str(exercise.id),
                    "name": exercise.name,
                    "created_by": str(user_id)
                }
            )
            
            # Log successful creation
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="exercise_created",
                resource_type="exercise",
                resource_id=str(exercise.id),
                details={"name": exercise.name}
            )
            
            return exercise
            
        except Exception as e:
            # Log error
            self.audit_logger.log_system_event(
                "exercise_creation_failed",
                "ExerciseApplicationService",
                {"error": str(e), "user_id": str(user_id)}
            )
            raise
    
    def get_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> Exercise:
        """
        Get exercise by ID with access control
        """
        try:
            exercise = self.exercise_repository.find_by_id(exercise_id)
            if not exercise:
                raise ValueError("Exercise not found")
            
            # Check access
            if not exercise.can_be_accessed_by(user_id):
                raise ValueError("User cannot access this exercise")
            
            # Log access
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="view_exercise",
                resource_type="exercise",
                resource_id=str(exercise_id)
            )
            
            return exercise
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "exercise_access_failed",
                "ExerciseApplicationService",
                {"error": str(e), "exercise_id": str(exercise_id), "user_id": str(user_id)}
            )
            raise
    
    @transaction.atomic
    def update_exercise(self, exercise_id: uuid.UUID, name: str = None, 
                       description: str = None, user_id: UserId = None) -> Exercise:
        """
        Update exercise with authorization
        """
        try:
            # Log audit event
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="update_exercise",
                resource_type="exercise",
                resource_id=str(exercise_id),
                details={"name": name, "description": description}
            )
            
            # Update exercise
            exercise = self.exercise_management_service.update_exercise(
                exercise_id, name, description, user_id
            )
            
            # Save updated exercise
            exercise = self.exercise_repository.save(exercise)
            
            # Publish domain events
            self._publish_domain_events(exercise)
            
            # Log successful update
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="exercise_updated",
                resource_type="exercise",
                resource_id=str(exercise_id)
            )
            
            return exercise
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "exercise_update_failed",
                "ExerciseApplicationService",
                {"error": str(e), "exercise_id": str(exercise_id), "user_id": str(user_id)}
            )
            raise
    
    @transaction.atomic
    def delete_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> None:
        """
        Delete exercise with authorization
        """
        try:
            # Log audit event
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="delete_exercise",
                resource_type="exercise",
                resource_id=str(exercise_id)
            )
            
            # Delete exercise
            self.exercise_management_service.delete_exercise(exercise_id, user_id)
            
            # Log successful deletion
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="exercise_deleted",
                resource_type="exercise",
                resource_id=str(exercise_id)
            )
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "exercise_deletion_failed",
                "ExerciseApplicationService",
                {"error": str(e), "exercise_id": str(exercise_id), "user_id": str(user_id)}
            )
            raise
    
    def list_exercises(self, user_id: UserId) -> List[Exercise]:
        """
        List exercises accessible to user
        """
        try:
            exercises = self.exercise_management_service.get_exercises_for_user(user_id)
            
            # Log access
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="list_exercises",
                resource_type="exercise",
                resource_id="all"
            )
            
            return exercises
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "exercise_listing_failed",
                "ExerciseApplicationService",
                {"error": str(e), "user_id": str(user_id)}
            )
            raise
    
    def list_exercises_by_creator(self, creator_id: UserId) -> List[Exercise]:
        """
        List exercises created by user
        """
        try:
            exercises = self.exercise_management_service.get_exercises_by_creator(creator_id)
            
            # Log access
            self.audit_logger.log_user_action(
                user_id=str(creator_id),
                action="list_own_exercises",
                resource_type="exercise",
                resource_id="own"
            )
            
            return exercises
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "own_exercise_listing_failed",
                "ExerciseApplicationService",
                {"error": str(e), "creator_id": str(creator_id)}
            )
            raise
    
    def _publish_domain_events(self, exercise: Exercise) -> None:
        """
        Publish domain events from exercise
        """
        events = exercise.get_domain_events()
        for event in events:
            # Here you would publish to an event bus
            # For now, we'll just log the event
            self.audit_logger.log_system_event(
                "domain_event",
                "ExerciseApplicationService",
                {"event_type": event.event_type, "aggregate_id": str(event.aggregate_id)}
            )
        
        # Clear events after publishing
        exercise.clear_domain_events()
