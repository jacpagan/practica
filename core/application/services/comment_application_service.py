"""
Comment application service - Orchestrates comment domain operations
"""

import uuid
from typing import List, Optional
from django.db import transaction

from ...domain.entities import VideoComment
from ...domain.value_objects import UserId
from ...domain.domain_services import CommentModerationService
from ...ports.outbound.repository_ports import CommentRepository, ExerciseRepository
from ...ports.outbound.notification_port import NotificationPort
from ...ports.outbound.audit_logger_port import AuditLoggerPort


class CommentApplicationService:
    """
    Application service for comment operations
    Orchestrates domain operations and coordinates with external systems
    """
    
    def __init__(
        self,
        comment_repository: CommentRepository,
        exercise_repository: ExerciseRepository,
        notification_port: NotificationPort,
        audit_logger: AuditLoggerPort
    ):
        self.comment_repository = comment_repository
        self.exercise_repository = exercise_repository
        self.notification_port = notification_port
        self.audit_logger = audit_logger
        
        # Create domain service
        self.comment_moderation_service = CommentModerationService(
            comment_repository, exercise_repository
        )
    
    @transaction.atomic
    def add_comment(self, exercise_id: uuid.UUID, author_id: UserId, 
                   video_asset_id: uuid.UUID, text: str = None) -> VideoComment:
        """
        Add comment to exercise
        Orchestrates the complete workflow
        """
        try:
            # Log audit event
            self.audit_logger.log_user_action(
                user_id=str(author_id),
                action="add_comment",
                resource_type="comment",
                resource_id="pending",
                details={"exercise_id": str(exercise_id)}
            )
            
            # Validate comment data
            validation_errors = self.comment_moderation_service.validate_comment_data(text, video_asset_id)
            if validation_errors:
                raise ValueError(f"Validation errors: {', '.join(validation_errors)}")
            
            # Add comment using domain service
            comment = self.comment_moderation_service.add_comment(
                exercise_id, author_id, video_asset_id, text
            )
            
            # Save comment
            comment = self.comment_repository.save(comment)
            
            # Moderate comment
            moderation_result = self.comment_moderation_service.moderate_comment(comment)
            
            # Publish domain events
            self._publish_domain_events(comment)
            
            # Send notification if needed
            if not moderation_result['is_approved']:
                self.notification_port.log_event(
                    "comment_moderation_required",
                    {
                        "comment_id": str(comment.id),
                        "exercise_id": str(exercise_id),
                        "author_id": str(author_id),
                        "reasons": moderation_result['reasons']
                    }
                )
            
            # Log successful creation
            self.audit_logger.log_user_action(
                user_id=str(author_id),
                action="comment_added",
                resource_type="comment",
                resource_id=str(comment.id),
                details={
                    "exercise_id": str(exercise_id),
                    "has_text": comment.has_text(),
                    "moderation_approved": moderation_result['is_approved']
                }
            )
            
            return comment
            
        except Exception as e:
            # Log error
            self.audit_logger.log_system_event(
                "comment_creation_failed",
                "CommentApplicationService",
                {"error": str(e), "exercise_id": str(exercise_id), "author_id": str(author_id)}
            )
            raise
    
    def get_comment(self, comment_id: uuid.UUID, user_id: UserId) -> VideoComment:
        """
        Get comment by ID with access control
        """
        try:
            comment = self.comment_repository.find_by_id(comment_id)
            if not comment:
                raise ValueError("Comment not found")
            
            # Check access
            if not comment.can_be_accessed_by(user_id):
                raise ValueError("User cannot access this comment")
            
            # Log access
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="view_comment",
                resource_type="comment",
                resource_id=str(comment_id)
            )
            
            return comment
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "comment_access_failed",
                "CommentApplicationService",
                {"error": str(e), "comment_id": str(comment_id), "user_id": str(user_id)}
            )
            raise
    
    @transaction.atomic
    def update_comment(self, comment_id: uuid.UUID, new_text: str, user_id: UserId) -> VideoComment:
        """
        Update comment with authorization
        """
        try:
            # Log audit event
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="update_comment",
                resource_type="comment",
                resource_id=str(comment_id),
                details={"new_text": new_text}
            )
            
            # Update comment using domain service
            comment = self.comment_moderation_service.update_comment(comment_id, new_text, user_id)
            
            # Save updated comment
            comment = self.comment_repository.save(comment)
            
            # Publish domain events
            self._publish_domain_events(comment)
            
            # Log successful update
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="comment_updated",
                resource_type="comment",
                resource_id=str(comment_id)
            )
            
            return comment
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "comment_update_failed",
                "CommentApplicationService",
                {"error": str(e), "comment_id": str(comment_id), "user_id": str(user_id)}
            )
            raise
    
    @transaction.atomic
    def delete_comment(self, comment_id: uuid.UUID, user_id: UserId) -> None:
        """
        Delete comment with authorization
        """
        try:
            # Log audit event
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="delete_comment",
                resource_type="comment",
                resource_id=str(comment_id)
            )
            
            # Delete comment using domain service
            self.comment_moderation_service.delete_comment(comment_id, user_id)
            
            # Log successful deletion
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="comment_deleted",
                resource_type="comment",
                resource_id=str(comment_id)
            )
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "comment_deletion_failed",
                "CommentApplicationService",
                {"error": str(e), "comment_id": str(comment_id), "user_id": str(user_id)}
            )
            raise
    
    def list_comments_for_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> List[VideoComment]:
        """
        List comments for exercise with access control
        """
        try:
            comments = self.comment_moderation_service.get_comments_for_exercise(exercise_id, user_id)
            
            # Log access
            self.audit_logger.log_user_action(
                user_id=str(user_id),
                action="list_exercise_comments",
                resource_type="comment",
                resource_id=str(exercise_id),
                details={"count": len(comments)}
            )
            
            return comments
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "comment_listing_failed",
                "CommentApplicationService",
                {"error": str(e), "exercise_id": str(exercise_id), "user_id": str(user_id)}
            )
            raise
    
    def list_comments_by_author(self, author_id: UserId) -> List[VideoComment]:
        """
        List comments by author
        """
        try:
            comments = self.comment_moderation_service.get_comments_by_author(author_id)
            
            # Log access
            self.audit_logger.log_user_action(
                user_id=str(author_id),
                action="list_own_comments",
                resource_type="comment",
                resource_id="own",
                details={"count": len(comments)}
            )
            
            return comments
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "own_comment_listing_failed",
                "CommentApplicationService",
                {"error": str(e), "author_id": str(author_id)}
            )
            raise
    
    def get_comment_statistics(self, exercise_id: uuid.UUID) -> dict:
        """
        Get comment statistics for exercise
        """
        try:
            stats = self.comment_moderation_service.get_comment_statistics(exercise_id)
            
            # Log access
            self.audit_logger.log_system_event(
                "comment_statistics_accessed",
                "CommentApplicationService",
                {"exercise_id": str(exercise_id), "stats": stats}
            )
            
            return stats
            
        except Exception as e:
            self.audit_logger.log_system_event(
                "comment_statistics_failed",
                "CommentApplicationService",
                {"error": str(e), "exercise_id": str(exercise_id)}
            )
            raise
    
    def _publish_domain_events(self, comment: VideoComment) -> None:
        """
        Publish domain events from comment
        """
        events = comment.get_domain_events()
        for event in events:
            # Here you would publish to an event bus
            # For now, we'll just log the event
            self.audit_logger.log_system_event(
                "domain_event",
                "CommentApplicationService",
                {"event_type": event.event_type, "aggregate_id": str(event.aggregate_id)}
            )
        
        # Clear events after publishing
        comment.clear_domain_events()
