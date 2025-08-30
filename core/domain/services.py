"""
Domain services for Practika MVP
Following Domain-Driven Design principles
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Set
from uuid import UUID
from datetime import datetime, timedelta

from .entities import VideoAsset, VideoClip, Comment, User, Exercise, TeacherStack, TimeRange, VideoMetadata
from .events import (
    VideoUploaded, ClipCreated, CommentAdded, TeacherStackUpdated,
    domain_event_bus
)


class VideoProcessingService:
    """
    Domain service for video processing operations
    """
    
    def __init__(self):
        self.supported_formats = {'mp4', 'webm', 'mov', 'avi'}
        self.max_file_size = 100 * 1024 * 1024  # 100MB
    
    def validate_video_upload(self, filename: str, size_bytes: int) -> bool:
        """
        Validate if a video can be uploaded
        """
        if size_bytes > self.max_file_size:
            return False
        
        file_extension = filename.split('.')[-1].lower()
        return file_extension in self.supported_formats
    
    def extract_video_metadata(self, video_asset: VideoAsset) -> Optional[VideoMetadata]:
        """
        Extract metadata from video asset
        This would typically call FFmpeg or similar
        """
        # This is a placeholder - in real implementation, call FFmpeg
        return VideoMetadata(
            width=1920,
            height=1080,
            duration=video_asset.duration,
            fps=30.0,
            codec='h264',
            file_size=video_asset.size_bytes
        )
    
    def can_create_clip(self, video_asset: VideoAsset, time_range: TimeRange) -> bool:
        """
        Check if a clip can be created from the video
        """
        if not video_asset.is_ready_for_processing():
            return False
        
        if time_range.end_time > video_asset.duration:
            return False
        
        return True


class ClipManagementService:
    """
    Domain service for clip management operations
    """
    
    def __init__(self):
        self.min_clip_duration = 1.0  # 1 second
        self.max_clip_duration = 300.0  # 5 minutes
    
    def validate_clip_creation(self, video_asset: VideoAsset, time_range: TimeRange) -> bool:
        """
        Validate if a clip can be created
        """
        if time_range.duration < self.min_clip_duration:
            return False
        
        if time_range.duration > self.max_clip_duration:
            return False
        
        if time_range.end_time > video_asset.duration:
            return False
        
        return True
    
    def calculate_clip_hash(self, video_id: UUID, start_time: float, end_time: float) -> str:
        """
        Calculate unique hash for clip selection
        """
        import hashlib
        clip_data = f"{video_id}:{start_time:.3f}:{end_time:.3f}"
        return hashlib.sha256(clip_data.encode()).hexdigest()
    
    def check_clip_exists(self, video_id: UUID, clip_hash: str) -> bool:
        """
        Check if a clip with the same hash already exists
        This would typically query the repository
        """
        # This is a placeholder - in real implementation, query repository
        return False


class CommentService:
    """
    Domain service for comment operations
    """
    
    def __init__(self):
        self.max_comment_length = 1000
        self.min_comment_length = 1
    
    def validate_comment(self, content: str, timestamp: Optional[float] = None) -> bool:
        """
        Validate comment content and timestamp
        """
        if len(content.strip()) < self.min_comment_length:
            return False
        
        if len(content) > self.max_comment_length:
            return False
        
        if timestamp is not None and timestamp < 0:
            return False
        
        return True
    
    def sanitize_comment_content(self, content: str) -> str:
        """
        Sanitize comment content
        """
        # Basic sanitization - in real implementation, use proper HTML sanitizer
        return content.strip()
    
    def can_user_comment(self, user: User, video_asset: VideoAsset) -> bool:
        """
        Check if user can comment on video
        """
        if not user.is_active:
            return False
        
        # Add more business rules as needed
        return True


class TeacherStackService:
    """
    Domain service for teacher stack operations
    """
    
    def __init__(self):
        self.review_threshold_days = 7
    
    def create_teacher_stack(self, exercise_id: UUID, student_id: UUID) -> TeacherStack:
        """
        Create a new teacher stack
        """
        return TeacherStack(
            exercise_id=exercise_id,
            student_id=student_id
        )
    
    def update_stack_with_submission(self, stack: TeacherStack, clip_id: UUID) -> None:
        """
        Update stack when student submits a clip
        """
        stack.add_submission(clip_id)
        
        # Publish domain event
        event = TeacherStackUpdated(
            stack_id=stack.id,
            exercise_id=stack.exercise_id,
            student_id=stack.student_id,
            submission_count=stack.submission_count,
            needs_review=stack.needs_review
        )
        domain_event_bus.publish(event)
    
    def mark_stack_as_reviewed(self, stack: TeacherStack) -> None:
        """
        Mark stack as reviewed by teacher
        """
        stack.mark_as_reviewed()
        
        # Publish domain event
        event = TeacherStackUpdated(
            stack_id=stack.id,
            exercise_id=stack.exercise_id,
            student_id=stack.student_id,
            submission_count=stack.submission_count,
            needs_review=stack.needs_review
        )
        domain_event_bus.publish(event)
    
    def get_stacks_needing_review(self, stacks: List[TeacherStack]) -> List[TeacherStack]:
        """
        Get stacks that need teacher review
        """
        return [stack for stack in stacks if stack.needs_review]
    
    def get_recently_active_stacks(self, stacks: List[TeacherStack], days: int = 7) -> List[TeacherStack]:
        """
        Get stacks with recent activity
        """
        return [stack for stack in stacks if stack.has_recent_activity(days)]
    
    def rank_stacks_by_priority(self, stacks: List[TeacherStack]) -> List[TeacherStack]:
        """
        Rank stacks by priority for teacher review
        Priority order: needs_review -> recent_activity -> submission_count
        """
        def priority_key(stack: TeacherStack) -> tuple:
            # Higher priority for stacks needing review
            review_priority = 0 if stack.needs_review else 1
            
            # Higher priority for recent activity
            activity_priority = 0 if stack.has_recent_activity() else 1
            
            # Higher priority for more submissions
            submission_priority = -stack.submission_count  # Negative for descending order
            
            return (review_priority, activity_priority, submission_priority)
        
        return sorted(stacks, key=priority_key)


class UserManagementService:
    """
    Domain service for user management operations
    """
    
    def __init__(self):
        self.min_username_length = 3
        self.max_username_length = 30
        self.reserved_usernames = {'admin', 'root', 'system', 'test'}
    
    def validate_username(self, username: str) -> bool:
        """
        Validate username format and availability
        """
        if len(username) < self.min_username_length:
            return False
        
        if len(username) > self.max_username_length:
            return False
        
        if username.lower() in self.reserved_usernames:
            return False
        
        # Check for valid characters (alphanumeric, underscore, hyphen)
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', username):
            return False
        
        return True
    
    def validate_email(self, email: str) -> bool:
        """
        Validate email format
        """
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def can_user_access_video(self, user: User, video_asset: VideoAsset) -> bool:
        """
        Check if user can access video
        """
        if not user.is_active:
            return False
        
        # Add more business rules as needed
        # For example: check if user is teacher, student, or video owner
        return True


class ExerciseService:
    """
    Domain service for exercise operations
    """
    
    def __init__(self):
        self.min_title_length = 3
        self.max_title_length = 200
        self.min_description_length = 10
        self.max_description_length = 2000
    
    def validate_exercise(self, title: str, description: str) -> bool:
        """
        Validate exercise title and description
        """
        if len(title.strip()) < self.min_title_length:
            return False
        
        if len(title) > self.max_title_length:
            return False
        
        if len(description.strip()) < self.min_description_length:
            return False
        
        if len(description) > self.max_description_length:
            return False
        
        return True
    
    def can_user_create_exercise(self, user: User) -> bool:
        """
        Check if user can create exercises
        """
        if not user.is_active:
            return False
        
        # Add more business rules as needed
        # For example: check if user is teacher
        return True
    
    def can_user_submit_to_exercise(self, user: User, exercise: Exercise) -> bool:
        """
        Check if user can submit to exercise
        """
        if not user.is_active:
            return False
        
        if not exercise.is_active:
            return False
        
        # Add more business rules as needed
        return True
