"""
Unit tests for domain services
Following Test-Driven Development principles
"""
import pytest
from uuid import uuid4
from core.domain.services import (
    VideoProcessingService, ClipManagementService, CommentService,
    TeacherStackService, UserManagementService, ExerciseService
)
from core.domain.entities import (
    VideoAsset, VideoClip, Comment, User, Exercise, TeacherStack,
    TimeRange, VideoMetadata
)


class TestVideoProcessingService:
    """Test VideoProcessingService domain service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = VideoProcessingService()
    
    def test_validate_video_upload_with_valid_video(self):
        """Test validate_video_upload with valid video"""
        # Arrange
        filename = "test-video.mp4"
        size_bytes = 50 * 1024 * 1024  # 50MB
        
        # Act
        result = self.service.validate_video_upload(filename, size_bytes)
        
        # Assert
        assert result is True
    
    def test_validate_video_upload_with_oversized_video(self):
        """Test validate_video_upload with oversized video"""
        # Arrange
        filename = "test-video.mp4"
        size_bytes = 150 * 1024 * 1024  # 150MB
        
        # Act
        result = self.service.validate_video_upload(filename, size_bytes)
        
        # Assert
        assert result is False
    
    def test_validate_video_upload_with_unsupported_format(self):
        """Test validate_video_upload with unsupported format"""
        # Arrange
        filename = "test-video.txt"
        size_bytes = 10 * 1024 * 1024  # 10MB
        
        # Act
        result = self.service.validate_video_upload(filename, size_bytes)
        
        # Assert
        assert result is False
    
    def test_validate_video_upload_with_supported_formats(self):
        """Test validate_video_upload with all supported formats"""
        # Arrange
        supported_formats = ["test.mp4", "test.webm", "test.mov", "test.avi"]
        
        for filename in supported_formats:
            # Act
            result = self.service.validate_video_upload(filename, 10 * 1024 * 1024)
            
            # Assert
            assert result is True
    
    def test_extract_video_metadata(self):
        """Test extract_video_metadata returns valid metadata"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act
        metadata = self.service.extract_video_metadata(video_asset)
        
        # Assert
        assert isinstance(metadata, VideoMetadata)
        assert metadata.width == 1920
        assert metadata.height == 1080
        assert metadata.duration == 30.0
        assert metadata.fps == 30.0
        assert metadata.codec == "h264"
        assert metadata.file_size == 1024000
    
    def test_can_create_clip_with_ready_video(self):
        """Test can_create_clip with ready video and valid time range"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4(),
            upload_status="completed"
        )
        time_range = TimeRange(start_time=10.0, end_time=20.0)
        
        # Act
        result = self.service.can_create_clip(video_asset, time_range)
        
        # Assert
        assert result is True
    
    def test_can_create_clip_with_pending_video(self):
        """Test can_create_clip with pending video"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4(),
            upload_status="pending"
        )
        time_range = TimeRange(start_time=10.0, end_time=20.0)
        
        # Act
        result = self.service.can_create_clip(video_asset, time_range)
        
        # Assert
        assert result is False
    
    def test_can_create_clip_with_invalid_time_range(self):
        """Test can_create_clip with time range exceeding video duration"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4(),
            upload_status="completed"
        )
        time_range = TimeRange(start_time=25.0, end_time=35.0)
        
        # Act
        result = self.service.can_create_clip(video_asset, time_range)
        
        # Assert
        assert result is False


class TestClipManagementService:
    """Test ClipManagementService domain service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = ClipManagementService()
    
    def test_validate_clip_creation_with_valid_range(self):
        """Test validate_clip_creation with valid time range"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        time_range = TimeRange(start_time=10.0, end_time=20.0)
        
        # Act
        result = self.service.validate_clip_creation(video_asset, time_range)
        
        # Assert
        assert result is True
    
    def test_validate_clip_creation_with_too_short_duration(self):
        """Test validate_clip_creation with too short duration"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        time_range = TimeRange(start_time=10.0, end_time=10.5)  # 0.5 seconds
        
        # Act
        result = self.service.validate_clip_creation(video_asset, time_range)
        
        # Assert
        assert result is False
    
    def test_validate_clip_creation_with_too_long_duration(self):
        """Test validate_clip_creation with too long duration"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        time_range = TimeRange(start_time=0.0, end_time=400.0)  # 400 seconds
        
        # Act
        result = self.service.validate_clip_creation(video_asset, time_range)
        
        # Assert
        assert result is False
    
    def test_validate_clip_creation_with_invalid_end_time(self):
        """Test validate_clip_creation with end time exceeding video duration"""
        # Arrange
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        time_range = TimeRange(start_time=25.0, end_time=35.0)
        
        # Act
        result = self.service.validate_clip_creation(video_asset, time_range)
        
        # Assert
        assert result is False
    
    def test_calculate_clip_hash(self):
        """Test calculate_clip_hash generates consistent hash"""
        # Arrange
        video_id = uuid4()
        start_time = 10.0
        end_time = 20.0
        
        # Act
        hash1 = self.service.calculate_clip_hash(video_id, start_time, end_time)
        hash2 = self.service.calculate_clip_hash(video_id, start_time, end_time)
        
        # Assert
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hash length
    
    def test_calculate_clip_hash_different_parameters(self):
        """Test calculate_clip_hash generates different hashes for different parameters"""
        # Arrange
        video_id = uuid4()
        
        # Act
        hash1 = self.service.calculate_clip_hash(video_id, 10.0, 20.0)
        hash2 = self.service.calculate_clip_hash(video_id, 15.0, 25.0)
        
        # Assert
        assert hash1 != hash2


class TestCommentService:
    """Test CommentService domain service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = CommentService()
    
    def test_validate_comment_with_valid_content(self):
        """Test validate_comment with valid content"""
        # Arrange
        content = "Great technique!"
        
        # Act
        result = self.service.validate_comment(content)
        
        # Assert
        assert result is True
    
    def test_validate_comment_with_empty_content(self):
        """Test validate_comment with empty content"""
        # Arrange
        content = "   "  # Whitespace only
        
        # Act
        result = self.service.validate_comment(content)
        
        # Assert
        assert result is False
    
    def test_validate_comment_with_too_long_content(self):
        """Test validate_comment with content exceeding max length"""
        # Arrange
        content = "A" * 1001  # Exceeds max length of 1000
        
        # Act
        result = self.service.validate_comment(content)
        
        # Assert
        assert result is False
    
    def test_validate_comment_with_negative_timestamp(self):
        """Test validate_comment with negative timestamp"""
        # Arrange
        content = "Test comment"
        timestamp = -1.0
        
        # Act
        result = self.service.validate_comment(content, timestamp)
        
        # Assert
        assert result is False
    
    def test_validate_comment_with_valid_timestamp(self):
        """Test validate_comment with valid timestamp"""
        # Arrange
        content = "Test comment"
        timestamp = 15.5
        
        # Act
        result = self.service.validate_comment(content, timestamp)
        
        # Assert
        assert result is True
    
    def test_sanitize_comment_content(self):
        """Test sanitize_comment_content removes leading/trailing whitespace"""
        # Arrange
        content = "  Test comment  "
        
        # Act
        result = self.service.sanitize_comment_content(content)
        
        # Assert
        assert result == "Test comment"
    
    def test_can_user_comment_with_active_user(self):
        """Test can_user_comment with active user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=True
        )
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act
        result = self.service.can_user_comment(user, video_asset)
        
        # Assert
        assert result is True
    
    def test_can_user_comment_with_inactive_user(self):
        """Test can_user_comment with inactive user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=False
        )
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act
        result = self.service.can_user_comment(user, video_asset)
        
        # Assert
        assert result is False


class TestTeacherStackService:
    """Test TeacherStackService domain service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = TeacherStackService()
    
    def test_create_teacher_stack(self):
        """Test create_teacher_stack creates valid stack"""
        # Arrange
        exercise_id = uuid4()
        student_id = uuid4()
        
        # Act
        stack = self.service.create_teacher_stack(exercise_id, student_id)
        
        # Assert
        assert stack.exercise_id == exercise_id
        assert stack.student_id == student_id
        assert stack.submission_count == 0
        assert stack.needs_review is False
    
    def test_update_stack_with_submission(self):
        """Test update_stack_with_submission updates stack correctly"""
        # Arrange
        stack = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4()
        )
        clip_id = uuid4()
        
        # Act
        self.service.update_stack_with_submission(stack, clip_id)
        
        # Assert
        assert stack.submission_count == 1
        assert stack.latest_clip_id == clip_id
        assert stack.needs_review is True
        assert stack.last_submission_at is not None
    
    def test_mark_stack_as_reviewed(self):
        """Test mark_stack_as_reviewed updates stack correctly"""
        # Arrange
        stack = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            needs_review=True
        )
        
        # Act
        self.service.mark_stack_as_reviewed(stack)
        
        # Assert
        assert stack.needs_review is False
        assert stack.updated_at > stack.created_at
    
    def test_get_stacks_needing_review(self):
        """Test get_stacks_needing_review filters correctly"""
        # Arrange
        stack1 = TeacherStack(exercise_id=uuid4(), student_id=uuid4(), needs_review=True)
        stack2 = TeacherStack(exercise_id=uuid4(), student_id=uuid4(), needs_review=False)
        stack3 = TeacherStack(exercise_id=uuid4(), student_id=uuid4(), needs_review=True)
        stacks = [stack1, stack2, stack3]
        
        # Act
        result = self.service.get_stacks_needing_review(stacks)
        
        # Assert
        assert len(result) == 2
        assert stack1 in result
        assert stack3 in result
        assert stack2 not in result
    
    def test_get_recently_active_stacks(self):
        """Test get_recently_active_stacks filters correctly"""
        # Arrange
        from datetime import datetime, timedelta
        
        # Create stacks with different activity times
        recent_time = datetime.now() - timedelta(days=3)
        old_time = datetime.now() - timedelta(days=10)
        
        stack1 = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            last_submission_at=recent_time
        )
        stack2 = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            last_submission_at=old_time
        )
        stack3 = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            last_submission_at=None
        )
        stacks = [stack1, stack2, stack3]
        
        # Act
        result = self.service.get_recently_active_stacks(stacks, days=7)
        
        # Assert
        assert len(result) == 1
        assert stack1 in result
        assert stack2 not in result
        assert stack3 not in result
    
    def test_rank_stacks_by_priority(self):
        """Test rank_stacks_by_priority sorts correctly"""
        # Arrange
        stack1 = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            needs_review=False,
            submission_count=1
        )
        stack2 = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            needs_review=True,
            submission_count=2
        )
        stack3 = TeacherStack(
            exercise_id=uuid4(),
            student_id=uuid4(),
            needs_review=True,
            submission_count=1
        )
        stacks = [stack1, stack2, stack3]
        
        # Act
        result = self.service.rank_stacks_by_priority(stacks)
        
        # Assert
        # Should be sorted by: needs_review (True first), then submission_count (higher first)
        assert result[0] == stack2  # needs_review=True, submission_count=2
        assert result[1] == stack3  # needs_review=True, submission_count=1
        assert result[2] == stack1  # needs_review=False, submission_count=1


class TestUserManagementService:
    """Test UserManagementService domain service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = UserManagementService()
    
    def test_validate_username_with_valid_username(self):
        """Test validate_username with valid username"""
        # Arrange
        username = "testuser123"
        
        # Act
        result = self.service.validate_username(username)
        
        # Assert
        assert result is True
    
    def test_validate_username_with_too_short_username(self):
        """Test validate_username with too short username"""
        # Arrange
        username = "ab"
        
        # Act
        result = self.service.validate_username(username)
        
        # Assert
        assert result is False
    
    def test_validate_username_with_too_long_username(self):
        """Test validate_username with too long username"""
        # Arrange
        username = "a" * 31  # Exceeds max length of 30
        
        # Act
        result = self.service.validate_username(username)
        
        # Assert
        assert result is False
    
    def test_validate_username_with_reserved_username(self):
        """Test validate_username with reserved username"""
        # Arrange
        username = "admin"
        
        # Act
        result = self.service.validate_username(username)
        
        # Assert
        assert result is False
    
    def test_validate_username_with_invalid_characters(self):
        """Test validate_username with invalid characters"""
        # Arrange
        username = "test@user"
        
        # Act
        result = self.service.validate_username(username)
        
        # Assert
        assert result is False
    
    def test_validate_email_with_valid_email(self):
        """Test validate_email with valid email"""
        # Arrange
        email = "test@example.com"
        
        # Act
        result = self.service.validate_email(email)
        
        # Assert
        assert result is True
    
    def test_validate_email_with_invalid_email(self):
        """Test validate_email with invalid email"""
        # Arrange
        email = "invalid-email"
        
        # Act
        result = self.service.validate_email(email)
        
        # Assert
        assert result is False
    
    def test_can_user_access_video_with_active_user(self):
        """Test can_user_access_video with active user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=True
        )
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act
        result = self.service.can_user_access_video(user, video_asset)
        
        # Assert
        assert result is True
    
    def test_can_user_access_video_with_inactive_user(self):
        """Test can_user_access_video with inactive user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=False
        )
        video_asset = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act
        result = self.service.can_user_access_video(user, video_asset)
        
        # Assert
        assert result is False


class TestExerciseService:
    """Test ExerciseService domain service"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = ExerciseService()
    
    def test_validate_exercise_with_valid_data(self):
        """Test validate_exercise with valid data"""
        # Arrange
        title = "Test Exercise"
        description = "This is a test exercise description that is long enough."
        
        # Act
        result = self.service.validate_exercise(title, description)
        
        # Assert
        assert result is True
    
    def test_validate_exercise_with_too_short_title(self):
        """Test validate_exercise with too short title"""
        # Arrange
        title = "ab"
        description = "This is a test exercise description that is long enough."
        
        # Act
        result = self.service.validate_exercise(title, description)
        
        # Assert
        assert result is False
    
    def test_validate_exercise_with_too_long_title(self):
        """Test validate_exercise with too long title"""
        # Arrange
        title = "a" * 201  # Exceeds max length of 200
        description = "This is a test exercise description that is long enough."
        
        # Act
        result = self.service.validate_exercise(title, description)
        
        # Assert
        assert result is False
    
    def test_validate_exercise_with_too_short_description(self):
        """Test validate_exercise with too short description"""
        # Arrange
        title = "Test Exercise"
        description = "Short"
        
        # Act
        result = self.service.validate_exercise(title, description)
        
        # Assert
        assert result is False
    
    def test_can_user_create_exercise_with_active_user(self):
        """Test can_user_create_exercise with active user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=True
        )
        
        # Act
        result = self.service.can_user_create_exercise(user)
        
        # Assert
        assert result is True
    
    def test_can_user_create_exercise_with_inactive_user(self):
        """Test can_user_create_exercise with inactive user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=False
        )
        
        # Act
        result = self.service.can_user_create_exercise(user)
        
        # Assert
        assert result is False
    
    def test_can_user_submit_to_exercise_with_valid_data(self):
        """Test can_user_submit_to_exercise with valid data"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=True
        )
        exercise = Exercise(
            title="Test Exercise",
            description="This is a test exercise description.",
            created_by_id=uuid4(),
            is_active=True
        )
        
        # Act
        result = self.service.can_user_submit_to_exercise(user, exercise)
        
        # Assert
        assert result is True
    
    def test_can_user_submit_to_exercise_with_inactive_user(self):
        """Test can_user_submit_to_exercise with inactive user"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=False
        )
        exercise = Exercise(
            title="Test Exercise",
            description="This is a test exercise description.",
            created_by_id=uuid4(),
            is_active=True
        )
        
        # Act
        result = self.service.can_user_submit_to_exercise(user, exercise)
        
        # Assert
        assert result is False
    
    def test_can_user_submit_to_exercise_with_inactive_exercise(self):
        """Test can_user_submit_to_exercise with inactive exercise"""
        # Arrange
        user = User(
            username="testuser",
            email="test@example.com",
            is_active=True
        )
        exercise = Exercise(
            title="Test Exercise",
            description="This is a test exercise description.",
            created_by_id=uuid4(),
            is_active=False
        )
        
        # Act
        result = self.service.can_user_submit_to_exercise(user, exercise)
        
        # Assert
        assert result is False
