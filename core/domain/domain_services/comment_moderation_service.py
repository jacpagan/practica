"""
Comment moderation domain service
"""

import uuid
from typing import List, Protocol
from datetime import datetime, timedelta

from ..entities import VideoComment, Exercise
from ..value_objects import UserId


class CommentRepository(Protocol):
    """Protocol for comment repository operations"""
    
    def save(self, comment: VideoComment) -> VideoComment:
        """Save comment"""
        ...
    
    def find_by_id(self, comment_id: uuid.UUID) -> VideoComment:
        """Find comment by ID"""
        ...
    
    def find_by_exercise(self, exercise_id: uuid.UUID) -> List[VideoComment]:
        """Find comments by exercise"""
        ...
    
    def find_by_author(self, author_id: UserId) -> List[VideoComment]:
        """Find comments by author"""
        ...
    
    def delete(self, comment_id: uuid.UUID) -> None:
        """Delete comment"""
        ...


class ExerciseRepository(Protocol):
    """Protocol for exercise repository operations"""
    
    def find_by_id(self, exercise_id: uuid.UUID) -> Exercise:
        """Find exercise by ID"""
        ...


class CommentModerationService:
    """
    Domain service for comment moderation operations
    Handles complex business logic for comment management and moderation
    """
    
    def __init__(self, comment_repository: CommentRepository, exercise_repository: ExerciseRepository):
        self.comment_repository = comment_repository
        self.exercise_repository = exercise_repository
    
    def add_comment(self, exercise_id: uuid.UUID, author_id: UserId, 
                   video_asset_id: uuid.UUID, text: str = None) -> VideoComment:
        """
        Add comment to exercise with business rule validation
        """
        # Validate exercise exists
        exercise = self.exercise_repository.find_by_id(exercise_id)
        if not exercise:
            raise ValueError("Exercise not found")
        
        # Validate user can access exercise
        if not exercise.can_be_accessed_by(author_id):
            raise ValueError("User cannot access this exercise")
        
        # Create comment
        comment = VideoComment.create(exercise_id, author_id, video_asset_id, text)
        
        # Save comment
        return self.comment_repository.save(comment)
    
    def update_comment(self, comment_id: uuid.UUID, new_text: str, updated_by: UserId) -> VideoComment:
        """
        Update comment with authorization check
        """
        comment = self.comment_repository.find_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        if not comment.can_be_modified_by(updated_by):
            raise ValueError("User is not authorized to modify this comment")
        
        # Update comment
        comment.update_text(new_text, updated_by)
        
        # Save updated comment
        return self.comment_repository.save(comment)
    
    def delete_comment(self, comment_id: uuid.UUID, deleted_by: UserId) -> None:
        """
        Delete comment with authorization check
        """
        comment = self.comment_repository.find_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        if not comment.can_be_deleted_by(deleted_by):
            raise ValueError("User is not authorized to delete this comment")
        
        # Delete comment
        self.comment_repository.delete(comment_id)
    
    def get_comments_for_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> List[VideoComment]:
        """
        Get comments for exercise with access control
        """
        # Validate exercise exists
        exercise = self.exercise_repository.find_by_id(exercise_id)
        if not exercise:
            raise ValueError("Exercise not found")
        
        # Validate user can access exercise
        if not exercise.can_be_accessed_by(user_id):
            raise ValueError("User cannot access this exercise")
        
        # Get comments
        return self.comment_repository.find_by_exercise(exercise_id)
    
    def get_comments_by_author(self, author_id: UserId) -> List[VideoComment]:
        """
        Get comments by specific author
        """
        return self.comment_repository.find_by_author(author_id)
    
    def get_recent_comments(self, hours: int = 24) -> List[VideoComment]:
        """
        Get recently created comments
        """
        all_comments = self.comment_repository.find_all()
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        return [comment for comment in all_comments if comment.created_at >= cutoff_time]
    
    def can_user_comment_on_exercise(self, exercise_id: uuid.UUID, user_id: UserId) -> bool:
        """
        Check if user can comment on exercise
        """
        # Validate exercise exists
        exercise = self.exercise_repository.find_by_id(exercise_id)
        if not exercise:
            return False
        
        # Check if user can access exercise
        return exercise.can_be_accessed_by(user_id)
    
    def get_comment_statistics(self, exercise_id: uuid.UUID) -> dict:
        """
        Get comment statistics for exercise
        """
        comments = self.comment_repository.find_by_exercise(exercise_id)
        
        total_comments = len(comments)
        comments_with_text = len([c for c in comments if c.has_text()])
        comments_with_video = len([c for c in comments if c.has_video()])
        recent_comments = len([c for c in comments if c.is_recent()])
        
        return {
            'total_comments': total_comments,
            'comments_with_text': comments_with_text,
            'comments_with_video': comments_with_video,
            'recent_comments': recent_comments,
            'exercise_id': str(exercise_id)
        }
    
    def validate_comment_data(self, text: str = None, video_asset_id: uuid.UUID = None) -> List[str]:
        """
        Validate comment data and return any errors
        """
        errors = []
        
        # Video is mandatory
        if not video_asset_id:
            errors.append("Video asset is required for comments")
        
        # Text is optional but if provided, must not be empty
        if text is not None and not text.strip():
            errors.append("Comment text cannot be empty if provided")
        
        # Text length limit
        if text and len(text) > 1000:
            errors.append("Comment text cannot exceed 1000 characters")
        
        return errors
    
    def moderate_comment(self, comment: VideoComment) -> dict:
        """
        Moderate comment content and return moderation result
        """
        moderation_result = {
            'is_approved': True,
            'warnings': [],
            'reasons': []
        }
        
        # Check for inappropriate content in text
        if comment.text:
            inappropriate_words = ['spam', 'inappropriate', 'offensive']  # Simplified list
            text_lower = comment.text.lower()
            
            for word in inappropriate_words:
                if word in text_lower:
                    moderation_result['is_approved'] = False
                    moderation_result['reasons'].append(f"Contains inappropriate content: {word}")
        
        # Check for excessive length
        if comment.text and len(comment.text) > 800:
            moderation_result['warnings'].append("Comment is very long")
        
        # Check for recent comment spam (simplified)
        if comment.is_recent(hours=1):
            # This would typically check against user's recent comment history
            pass
        
        return moderation_result
