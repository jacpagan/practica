"""
Acceptance tests for MVP core loop: Upload → Reply → Compare
Following Test-Driven Development principles
"""
import pytest
from uuid import uuid4
from datetime import datetime
from core.domain.entities import (
    VideoAsset, VideoClip, Comment, User, Exercise, TeacherStack,
    TimeRange
)
from core.domain.services import (
    VideoProcessingService, ClipManagementService, CommentService,
    TeacherStackService
)
from core.domain.events import (
    VideoUploaded, ClipCreated, CommentAdded, TeacherStackUpdated,
    domain_event_bus
)


class TestMVPUploadReplyCompareLoop:
    """Test the complete MVP core loop: Upload → Reply → Compare"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.video_service = VideoProcessingService()
        self.clip_service = ClipManagementService()
        self.comment_service = CommentService()
        self.stack_service = TeacherStackService()
        
        # Create test user
        self.student = User(
            username="teststudent",
            email="student@example.com",
            is_active=True
        )
        
        self.teacher = User(
            username="testteacher",
            email="teacher@example.com",
            is_active=True
        )
        
        # Create test exercise
        self.exercise = Exercise(
            title="Test Exercise",
            description="This is a test exercise for the MVP core loop.",
            created_by_id=self.teacher.id,
            is_active=True
        )
    
    def test_complete_upload_reply_compare_loop(self):
        """
        Test the complete MVP core loop:
        1. Student uploads video
        2. Student creates clip from video
        3. Student adds comment to clip
        4. Teacher views stack
        5. Teacher provides feedback
        """
        # Step 1: Student uploads video
        video_asset = self._upload_video()
        assert video_asset.upload_status == "completed"
        assert video_asset.is_ready_for_processing() is True
        
        # Step 2: Student creates clip from video
        clip = self._create_clip(video_asset)
        assert clip.is_processing_complete() is True
        assert clip.duration == 10.0
        
        # Step 3: Student adds comment to clip
        comment = self._add_comment(video_asset, clip)
        assert comment.is_timestamped() is True
        assert comment.timestamp == 15.0
        
        # Step 4: Teacher stack is updated
        stack = self._get_or_create_teacher_stack()
        self.stack_service.update_stack_with_submission(stack, clip.id)
        assert stack.submission_count == 1
        assert stack.needs_review is True
        assert stack.latest_clip_id == clip.id
        
        # Step 5: Teacher reviews stack
        self.stack_service.mark_stack_as_reviewed(stack)
        assert stack.needs_review is False
        
        # Verify all data is connected
        assert video_asset.id == clip.original_video_id
        assert comment.video_id == video_asset.id
        assert stack.exercise_id == self.exercise.id
        assert stack.student_id == self.student.id
    
    def test_clip_idempotency(self):
        """Test that creating the same clip twice returns the same clip"""
        # Arrange
        video_asset = self._upload_video()
        time_range = TimeRange(start_time=10.0, end_time=20.0)
        
        # Act - Create clip twice with same parameters
        clip1 = self._create_clip(video_asset, time_range)
        clip2 = self._create_clip(video_asset, time_range)
        
        # Assert - Should be the same clip (idempotent)
        assert clip1.clip_hash == clip2.clip_hash
        assert clip1.start_time == clip2.start_time
        assert clip1.end_time == clip2.end_time
    
    def test_multiple_clips_from_same_video(self):
        """Test creating multiple clips from the same video"""
        # Arrange
        video_asset = self._upload_video()
        
        # Act - Create multiple clips
        clip1 = self._create_clip(video_asset, TimeRange(start_time=5.0, end_time=15.0))
        clip2 = self._create_clip(video_asset, TimeRange(start_time=15.0, end_time=25.0))
        clip3 = self._create_clip(video_asset, TimeRange(start_time=25.0, end_time=30.0))
        
        # Assert
        assert clip1.clip_hash != clip2.clip_hash
        assert clip2.clip_hash != clip3.clip_hash
        assert clip1.original_video_id == video_asset.id
        assert clip2.original_video_id == video_asset.id
        assert clip3.original_video_id == video_asset.id
    
    def test_teacher_stack_aggregation(self):
        """Test teacher stack aggregation with multiple submissions"""
        # Arrange
        video_asset = self._upload_video()
        stack = self._get_or_create_teacher_stack()
        
        # Act - Create multiple clips and update stack
        clip1 = self._create_clip(video_asset, TimeRange(start_time=5.0, end_time=15.0))
        self.stack_service.update_stack_with_submission(stack, clip1.id)
        
        clip2 = self._create_clip(video_asset, TimeRange(start_time=15.0, end_time=25.0))
        self.stack_service.update_stack_with_submission(stack, clip2.id)
        
        clip3 = self._create_clip(video_asset, TimeRange(start_time=25.0, end_time=30.0))
        self.stack_service.update_stack_with_submission(stack, clip3.id)
        
        # Assert
        assert stack.submission_count == 3
        assert stack.latest_clip_id == clip3.id
        assert stack.needs_review is True
        
        # Teacher reviews
        self.stack_service.mark_stack_as_reviewed(stack)
        assert stack.needs_review is False
    
    def test_comment_timestamping(self):
        """Test comment timestamping functionality"""
        # Arrange
        video_asset = self._upload_video()
        clip = self._create_clip(video_asset)
        
        # Act - Add comments with different timestamps
        comment1 = self._add_comment(video_asset, clip, timestamp=12.5)
        comment2 = self._add_comment(video_asset, clip, timestamp=17.5)
        comment3 = self._add_comment(video_asset, clip)  # No timestamp
        
        # Assert
        assert comment1.is_timestamped() is True
        assert comment1.timestamp == 12.5
        assert comment2.is_timestamped() is True
        assert comment2.timestamp == 17.5
        assert comment3.is_timestamped() is False
        assert comment3.timestamp is None
    
    def test_invalid_clip_creation(self):
        """Test that invalid clip creation is rejected"""
        # Arrange
        video_asset = self._upload_video()
        
        # Act & Assert - Try to create invalid clips
        with pytest.raises(ValueError):
            self._create_clip(video_asset, TimeRange(start_time=-1.0, end_time=10.0))
        
        with pytest.raises(ValueError):
            self._create_clip(video_asset, TimeRange(start_time=20.0, end_time=10.0))
        
        with pytest.raises(ValueError):
            self._create_clip(video_asset, TimeRange(start_time=25.0, end_time=35.0))
    
    def test_invalid_comment_creation(self):
        """Test that invalid comment creation is rejected"""
        # Arrange
        video_asset = self._upload_video()
        clip = self._create_clip(video_asset)
        
        # Act & Assert - Try to create invalid comments
        with pytest.raises(ValueError):
            self._add_comment(video_asset, clip, content="")
        
        with pytest.raises(ValueError):
            self._add_comment(video_asset, clip, content="A" * 1001)  # Too long
        
        with pytest.raises(ValueError):
            self._add_comment(video_asset, clip, timestamp=-1.0)
    
    def test_teacher_stack_priority_ranking(self):
        """Test teacher stack priority ranking"""
        # Arrange
        stack1 = TeacherStack(
            exercise_id=self.exercise.id,
            student_id=self.student.id,
            needs_review=False,
            submission_count=1
        )
        
        stack2 = TeacherStack(
            exercise_id=self.exercise.id,
            student_id=uuid4(),
            needs_review=True,
            submission_count=2
        )
        
        stack3 = TeacherStack(
            exercise_id=self.exercise.id,
            student_id=uuid4(),
            needs_review=True,
            submission_count=1
        )
        
        stacks = [stack1, stack2, stack3]
        
        # Act
        ranked_stacks = self.stack_service.rank_stacks_by_priority(stacks)
        
        # Assert - Should be sorted by: needs_review (True first), then submission_count (higher first)
        assert ranked_stacks[0] == stack2  # needs_review=True, submission_count=2
        assert ranked_stacks[1] == stack3  # needs_review=True, submission_count=1
        assert ranked_stacks[2] == stack1  # needs_review=False, submission_count=1
    
    def test_domain_events_publishing(self):
        """Test that domain events are published correctly"""
        # Arrange
        events_published = []
        
        def capture_event(event):
            events_published.append(event)
        
        # Subscribe to events
        domain_event_bus.subscribe("VideoUploaded", type("TestHandler", (), {"handle": capture_event})())
        domain_event_bus.subscribe("ClipCreated", type("TestHandler", (), {"handle": capture_event})())
        domain_event_bus.subscribe("CommentAdded", type("TestHandler", (), {"handle": capture_event})())
        domain_event_bus.subscribe("TeacherStackUpdated", type("TestHandler", (), {"handle": capture_event})())
        
        # Act - Execute core loop
        video_asset = self._upload_video()
        clip = self._create_clip(video_asset)
        comment = self._add_comment(video_asset, clip)
        stack = self._get_or_create_teacher_stack()
        self.stack_service.update_stack_with_submission(stack, clip.id)
        
        # Assert - Check that events were published
        assert len(events_published) >= 4  # At least 4 events should be published
        
        # Check event types
        event_types = [event.event_type for event in events_published]
        assert "VideoUploaded" in event_types
        assert "ClipCreated" in event_types
        assert "CommentAdded" in event_types
        assert "TeacherStackUpdated" in event_types
    
    def test_performance_requirements(self):
        """Test that core operations meet performance requirements"""
        import time
        
        # Arrange
        video_asset = self._upload_video()
        
        # Act & Assert - Test clip creation performance
        start_time = time.time()
        clip = self._create_clip(video_asset)
        end_time = time.time()
        
        clip_creation_time = end_time - start_time
        assert clip_creation_time < 5.0  # Should complete within 5 seconds
        
        # Test comment creation performance
        start_time = time.time()
        comment = self._add_comment(video_asset, clip)
        end_time = time.time()
        
        comment_creation_time = end_time - start_time
        assert comment_creation_time < 1.0  # Should complete within 1 second
    
    # Helper methods
    def _upload_video(self) -> VideoAsset:
        """Helper method to upload a video"""
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=self.student.id,
            upload_status="completed"
        )
        
        # Publish domain event
        event = VideoUploaded(
            video_id=video_asset.id,
            filename=video_asset.orig_filename,
            size_bytes=video_asset.size_bytes,
            uploaded_by_id=video_asset.uploaded_by_id,
            storage_path=video_asset.storage_path
        )
        domain_event_bus.publish(event)
        
        return video_asset
    
    def _create_clip(self, video_asset: VideoAsset, time_range: TimeRange = None) -> VideoClip:
        """Helper method to create a clip"""
        if time_range is None:
            time_range = TimeRange(start_time=10.0, end_time=20.0)
        
        # Validate clip creation
        if not self.clip_service.validate_clip_creation(video_asset, time_range):
            raise ValueError("Invalid clip creation parameters")
        
        clip = VideoClip(
            original_video_id=video_asset.id,
            start_time=time_range.start_time,
            end_time=time_range.end_time,
            duration=time_range.duration,
            storage_path=f"clips/{video_asset.id}_{time_range.start_time}_{time_range.end_time}.mp4",
            processing_status="completed"
        )
        
        # Publish domain event
        event = ClipCreated(
            clip_id=clip.id,
            video_id=video_asset.id,
            start_time=clip.start_time,
            end_time=clip.end_time,
            duration=clip.duration,
            created_by_id=self.student.id
        )
        domain_event_bus.publish(event)
        
        return clip
    
    def _add_comment(self, video_asset: VideoAsset, clip: VideoClip = None, 
                    content: str = "Great technique!", timestamp: float = 15.0) -> Comment:
        """Helper method to add a comment"""
        # Validate comment
        if not self.comment_service.validate_comment(content, timestamp):
            raise ValueError("Invalid comment parameters")
        
        comment = Comment(
            video_id=video_asset.id,
            author_id=self.student.id,
            content=self.comment_service.sanitize_comment_content(content),
            timestamp=timestamp
        )
        
        # Publish domain event
        event = CommentAdded(
            comment_id=comment.id,
            video_id=comment.video_id,
            author_id=comment.author_id,
            content=comment.content,
            timestamp=comment.timestamp
        )
        domain_event_bus.publish(event)
        
        return comment
    
    def _get_or_create_teacher_stack(self) -> TeacherStack:
        """Helper method to get or create a teacher stack"""
        stack = TeacherStack(
            exercise_id=self.exercise.id,
            student_id=self.student.id
        )
        
        # Publish domain event
        event = TeacherStackUpdated(
            stack_id=stack.id,
            exercise_id=stack.exercise_id,
            student_id=stack.student_id,
            submission_count=stack.submission_count,
            needs_review=stack.needs_review
        )
        domain_event_bus.publish(event)
        
        return stack
