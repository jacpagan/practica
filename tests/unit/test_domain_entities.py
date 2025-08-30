"""
Unit tests for domain entities
Following Test-Driven Development principles
"""
import pytest
from datetime import datetime
from uuid import uuid4
from core.domain.entities import (
    VideoAsset, VideoClip, Comment, User, Exercise, TeacherStack,
    TimeRange, VideoMetadata
)


class TestVideoAsset:
    """Test VideoAsset domain entity"""
    
    def test_create_valid_video_asset(self):
        """Test creating a valid video asset"""
        # Arrange
        video_id = uuid4()
        user_id = uuid4()
        
        # Act
        video = VideoAsset(
            id=video_id,
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=user_id
        )
        
        # Assert
        assert video.id == video_id
        assert video.orig_filename == "test-video.mp4"
        assert video.size_bytes == 1024000
        assert video.duration == 30.0
        assert video.uploaded_by_id == user_id
        assert video.upload_status == "pending"
    
    def test_video_asset_with_invalid_size_raises_error(self):
        """Test that video asset with invalid size raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Video size must be positive"):
            VideoAsset(
                orig_filename="test-video.mp4",
                storage_path="videos/test-video.mp4",
                size_bytes=0,
                duration=30.0,
                uploaded_by_id=uuid4()
            )
    
    def test_video_asset_with_invalid_duration_raises_error(self):
        """Test that video asset with invalid duration raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Video duration must be positive"):
            VideoAsset(
                orig_filename="test-video.mp4",
                storage_path="videos/test-video.mp4",
                size_bytes=1024000,
                duration=0,
                uploaded_by_id=uuid4()
            )
    
    def test_video_asset_without_filename_raises_error(self):
        """Test that video asset without filename raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Original filename is required"):
            VideoAsset(
                orig_filename="",
                storage_path="videos/test-video.mp4",
                size_bytes=1024000,
                duration=30.0,
                uploaded_by_id=uuid4()
            )
    
    def test_is_ready_for_processing_when_completed(self):
        """Test is_ready_for_processing returns True when upload is completed"""
        # Arrange
        video = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4(),
            upload_status="completed"
        )
        
        # Act & Assert
        assert video.is_ready_for_processing() is True
    
    def test_is_ready_for_processing_when_pending(self):
        """Test is_ready_for_processing returns False when upload is pending"""
        # Arrange
        video = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4(),
            upload_status="pending"
        )
        
        # Act & Assert
        assert video.is_ready_for_processing() is False
    
    def test_get_file_extension(self):
        """Test getting file extension from filename"""
        # Arrange
        video = VideoAsset(
            orig_filename="test-video.mp4",
            storage_path="videos/test-video.mp4",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act & Assert
        assert video.get_file_extension() == "mp4"
    
    def test_is_valid_format_with_supported_format(self):
        """Test is_valid_format returns True for supported formats"""
        # Arrange
        supported_formats = ["test-video.mp4", "test-video.webm", "test-video.mov", "test-video.avi"]
        
        for filename in supported_formats:
            video = VideoAsset(
                orig_filename=filename,
                storage_path=f"videos/{filename}",
                size_bytes=1024000,
                duration=30.0,
                uploaded_by_id=uuid4()
            )
            
            # Act & Assert
            assert video.is_valid_format() is True
    
    def test_is_valid_format_with_unsupported_format(self):
        """Test is_valid_format returns False for unsupported formats"""
        # Arrange
        video = VideoAsset(
            orig_filename="test-video.txt",
            storage_path="videos/test-video.txt",
            size_bytes=1024000,
            duration=30.0,
            uploaded_by_id=uuid4()
        )
        
        # Act & Assert
        assert video.is_valid_format() is False


class TestVideoClip:
    """Test VideoClip domain entity"""
    
    def test_create_valid_video_clip(self):
        """Test creating a valid video clip"""
        # Arrange
        clip_id = uuid4()
        video_id = uuid4()
        
        # Act
        clip = VideoClip(
            id=clip_id,
            original_video_id=video_id,
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4"
        )
        
        # Assert
        assert clip.id == clip_id
        assert clip.original_video_id == video_id
        assert clip.start_time == 10.0
        assert clip.end_time == 20.0
        assert clip.duration == 10.0
        assert clip.processing_status == "pending"
        assert clip.clip_hash is not None
    
    def test_video_clip_with_invalid_start_time_raises_error(self):
        """Test that video clip with negative start time raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Start time cannot be negative"):
            VideoClip(
                original_video_id=uuid4(),
                start_time=-1.0,
                end_time=20.0,
                duration=21.0,
                storage_path="clips/test-clip.mp4"
            )
    
    def test_video_clip_with_invalid_time_range_raises_error(self):
        """Test that video clip with end time <= start time raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="End time must be greater than start time"):
            VideoClip(
                original_video_id=uuid4(),
                start_time=20.0,
                end_time=10.0,
                duration=-10.0,
                storage_path="clips/test-clip.mp4"
            )
    
    def test_video_clip_auto_calculates_duration(self):
        """Test that video clip auto-calculates duration if not provided"""
        # Arrange
        clip = VideoClip(
            original_video_id=uuid4(),
            start_time=10.0,
            end_time=20.0,
            duration=0.0,  # Will be auto-calculated
            storage_path="clips/test-clip.mp4"
        )
        
        # Act & Assert
        assert clip.duration == 10.0
    
    def test_generate_clip_hash(self):
        """Test that clip hash is generated correctly"""
        # Arrange
        video_id = uuid4()
        clip = VideoClip(
            original_video_id=video_id,
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4"
        )
        
        # Act
        expected_hash = clip._generate_clip_hash()
        
        # Assert
        assert clip.clip_hash == expected_hash
        assert len(clip.clip_hash) == 64  # SHA256 hash length
    
    def test_is_processing_complete(self):
        """Test is_processing_complete returns True when processing is completed"""
        # Arrange
        clip = VideoClip(
            original_video_id=uuid4(),
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4",
            processing_status="completed"
        )
        
        # Act & Assert
        assert clip.is_processing_complete() is True
    
    def test_is_processing_failed(self):
        """Test is_processing_failed returns True when processing failed"""
        # Arrange
        clip = VideoClip(
            original_video_id=uuid4(),
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4",
            processing_status="failed"
        )
        
        # Act & Assert
        assert clip.is_processing_failed() is True
    
    def test_mark_as_processing(self):
        """Test mark_as_processing updates status correctly"""
        # Arrange
        clip = VideoClip(
            original_video_id=uuid4(),
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4"
        )
        
        # Act
        clip.mark_as_processing()
        
        # Assert
        assert clip.processing_status == "processing"
        assert clip.updated_at > clip.created_at
    
    def test_mark_as_completed(self):
        """Test mark_as_completed updates status and metadata correctly"""
        # Arrange
        clip = VideoClip(
            original_video_id=uuid4(),
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4"
        )
        
        # Act
        clip.mark_as_completed("clips/processed-clip.mp4", 512000)
        
        # Assert
        assert clip.processing_status == "completed"
        assert clip.storage_path == "clips/processed-clip.mp4"
        assert clip.size_bytes == 512000
        assert clip.processed_at is not None
        assert clip.updated_at > clip.created_at
    
    def test_mark_as_failed(self):
        """Test mark_as_failed updates status and error message correctly"""
        # Arrange
        clip = VideoClip(
            original_video_id=uuid4(),
            start_time=10.0,
            end_time=20.0,
            duration=10.0,
            storage_path="clips/test-clip.mp4"
        )
        
        # Act
        clip.mark_as_failed("FFmpeg processing failed")
        
        # Assert
        assert clip.processing_status == "failed"
        assert clip.processing_error == "FFmpeg processing failed"
        assert clip.updated_at > clip.created_at


class TestComment:
    """Test Comment domain entity"""
    
    def test_create_valid_comment(self):
        """Test creating a valid comment"""
        # Arrange
        comment_id = uuid4()
        video_id = uuid4()
        author_id = uuid4()
        
        # Act
        comment = Comment(
            id=comment_id,
            video_id=video_id,
            author_id=author_id,
            content="Great technique!",
            timestamp=15.5
        )
        
        # Assert
        assert comment.id == comment_id
        assert comment.video_id == video_id
        assert comment.author_id == author_id
        assert comment.content == "Great technique!"
        assert comment.timestamp == 15.5
    
    def test_comment_with_empty_content_raises_error(self):
        """Test that comment with empty content raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Comment content cannot be empty"):
            Comment(
                video_id=uuid4(),
                author_id=uuid4(),
                content=""
            )
    
    def test_comment_with_negative_timestamp_raises_error(self):
        """Test that comment with negative timestamp raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Timestamp cannot be negative"):
            Comment(
                video_id=uuid4(),
                author_id=uuid4(),
                content="Test comment",
                timestamp=-1.0
            )
    
    def test_is_timestamped_with_timestamp(self):
        """Test is_timestamped returns True when timestamp is provided"""
        # Arrange
        comment = Comment(
            video_id=uuid4(),
            author_id=uuid4(),
            content="Test comment",
            timestamp=15.5
        )
        
        # Act & Assert
        assert comment.is_timestamped() is True
    
    def test_is_timestamped_without_timestamp(self):
        """Test is_timestamped returns False when timestamp is not provided"""
        # Arrange
        comment = Comment(
            video_id=uuid4(),
            author_id=uuid4(),
            content="Test comment"
        )
        
        # Act & Assert
        assert comment.is_timestamped() is False
    
    def test_get_content_preview_short_content(self):
        """Test get_content_preview returns full content for short comments"""
        # Arrange
        comment = Comment(
            video_id=uuid4(),
            author_id=uuid4(),
            content="Short comment"
        )
        
        # Act & Assert
        assert comment.get_content_preview(100) == "Short comment"
    
    def test_get_content_preview_long_content(self):
        """Test get_content_preview truncates long content"""
        # Arrange
        long_content = "A" * 150
        comment = Comment(
            video_id=uuid4(),
            author_id=uuid4(),
            content=long_content
        )
        
        # Act
        preview = comment.get_content_preview(100)
        
        # Assert
        assert len(preview) == 103  # 100 chars + "..."
        assert preview.endswith("...")


class TestTimeRange:
    """Test TimeRange value object"""
    
    def test_create_valid_time_range(self):
        """Test creating a valid time range"""
        # Arrange & Act
        time_range = TimeRange(start_time=10.0, end_time=20.0)
        
        # Assert
        assert time_range.start_time == 10.0
        assert time_range.end_time == 20.0
        assert time_range.duration == 10.0
    
    def test_time_range_with_negative_start_time_raises_error(self):
        """Test that time range with negative start time raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Start time cannot be negative"):
            TimeRange(start_time=-1.0, end_time=20.0)
    
    def test_time_range_with_invalid_range_raises_error(self):
        """Test that time range with end <= start raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="End time must be greater than start time"):
            TimeRange(start_time=20.0, end_time=10.0)
    
    def test_duration_property(self):
        """Test duration property calculation"""
        # Arrange
        time_range = TimeRange(start_time=5.0, end_time=15.0)
        
        # Act & Assert
        assert time_range.duration == 10.0
    
    def test_overlaps_with_overlapping_ranges(self):
        """Test overlaps_with returns True for overlapping ranges"""
        # Arrange
        range1 = TimeRange(start_time=10.0, end_time=20.0)
        range2 = TimeRange(start_time=15.0, end_time=25.0)
        
        # Act & Assert
        assert range1.overlaps_with(range2) is True
        assert range2.overlaps_with(range1) is True
    
    def test_overlaps_with_non_overlapping_ranges(self):
        """Test overlaps_with returns False for non-overlapping ranges"""
        # Arrange
        range1 = TimeRange(start_time=10.0, end_time=20.0)
        range2 = TimeRange(start_time=25.0, end_time=35.0)
        
        # Act & Assert
        assert range1.overlaps_with(range2) is False
        assert range2.overlaps_with(range1) is False
    
    def test_overlaps_with_adjacent_ranges(self):
        """Test overlaps_with returns False for adjacent ranges"""
        # Arrange
        range1 = TimeRange(start_time=10.0, end_time=20.0)
        range2 = TimeRange(start_time=20.0, end_time=30.0)
        
        # Act & Assert
        assert range1.overlaps_with(range2) is False
        assert range2.overlaps_with(range1) is False


class TestVideoMetadata:
    """Test VideoMetadata value object"""
    
    def test_create_valid_video_metadata(self):
        """Test creating valid video metadata"""
        # Arrange & Act
        metadata = VideoMetadata(
            width=1920,
            height=1080,
            duration=30.0,
            fps=30.0,
            codec="h264",
            file_size=1024000
        )
        
        # Assert
        assert metadata.width == 1920
        assert metadata.height == 1080
        assert metadata.duration == 30.0
        assert metadata.fps == 30.0
        assert metadata.codec == "h264"
        assert metadata.file_size == 1024000
    
    def test_video_metadata_with_invalid_dimensions_raises_error(self):
        """Test that video metadata with invalid dimensions raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Video dimensions must be positive"):
            VideoMetadata(
                width=0,
                height=1080,
                duration=30.0,
                fps=30.0,
                codec="h264",
                file_size=1024000
            )
    
    def test_video_metadata_with_invalid_duration_raises_error(self):
        """Test that video metadata with invalid duration raises error"""
        # Arrange & Act & Assert
        with pytest.raises(ValueError, match="Video duration must be positive"):
            VideoMetadata(
                width=1920,
                height=1080,
                duration=0,
                fps=30.0,
                codec="h264",
                file_size=1024000
            )
    
    def test_aspect_ratio_property(self):
        """Test aspect ratio property calculation"""
        # Arrange
        metadata = VideoMetadata(
            width=1920,
            height=1080,
            duration=30.0,
            fps=30.0,
            codec="h264",
            file_size=1024000
        )
        
        # Act & Assert
        assert metadata.aspect_ratio == 16/9
    
    def test_is_hd_property(self):
        """Test is_hd property"""
        # Arrange
        hd_metadata = VideoMetadata(
            width=1920,
            height=1080,
            duration=30.0,
            fps=30.0,
            codec="h264",
            file_size=1024000
        )
        
        sd_metadata = VideoMetadata(
            width=640,
            height=480,
            duration=30.0,
            fps=30.0,
            codec="h264",
            file_size=1024000
        )
        
        # Act & Assert
        assert hd_metadata.is_hd is True
        assert sd_metadata.is_hd is False
    
    def test_is_4k_property(self):
        """Test is_4k property"""
        # Arrange
        four_k_metadata = VideoMetadata(
            width=3840,
            height=2160,
            duration=30.0,
            fps=30.0,
            codec="h264",
            file_size=1024000
        )
        
        hd_metadata = VideoMetadata(
            width=1920,
            height=1080,
            duration=30.0,
            fps=30.0,
            codec="h264",
            file_size=1024000
        )
        
        # Act & Assert
        assert four_k_metadata.is_4k is True
        assert hd_metadata.is_4k is False
