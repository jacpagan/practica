import pytest
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from core.models import VideoAsset
from exercises.models import Exercise
from comments.models import VideoComment
from tests.factories import TestDataFactory


class VideoAssetModelTest(TestCase):
    """Test VideoAsset model functionality"""
    
    def setUp(self):
        self.user = TestDataFactory.create_user()
        self.video_asset = TestDataFactory.create_video_asset()
    
    def test_video_asset_creation(self):
        """Test VideoAsset creation with valid data"""
        self.assertIsNotNone(self.video_asset.id)
        self.assertEqual(self.video_asset.orig_filename, 'test_video.mp4')
        self.assertEqual(self.video_asset.mime_type, 'video/mp4')
        self.assertEqual(self.video_asset.size_bytes, 1024)
        self.assertEqual(self.video_asset.processing_status, 'completed')
        self.assertTrue(self.video_asset.is_valid)
    
    def test_video_asset_str_representation(self):
        """Test VideoAsset string representation"""
        expected_str = f"test_video.mp4 ({self.video_asset.id})"
        self.assertEqual(str(self.video_asset), expected_str)
    
    def test_video_asset_checksum_auto_calculation(self):
        """Test that checksum is automatically calculated"""
        # Create a new video asset without checksum
        new_asset = TestDataFactory.create_video_asset(checksum_sha256='')
        self.assertNotEqual(new_asset.checksum_sha256, '')
        self.assertEqual(len(new_asset.checksum_sha256), 64)
    
    def test_video_asset_validation(self):
        """Test VideoAsset validation"""
        # Test with invalid MIME type
        with self.assertRaises(ValidationError):
            invalid_asset = TestDataFactory.create_video_asset(mime_type='invalid/mime')
            invalid_asset.full_clean()
        
        # Test with invalid checksum length
        with self.assertRaises(ValidationError):
            invalid_asset = TestDataFactory.create_video_asset(checksum_sha256='short')
            invalid_asset.full_clean()
    
    def test_video_asset_processing_status(self):
        """Test VideoAsset processing status updates"""
        # Test status transition
        self.video_asset.processing_status = 'processing'
        self.video_asset.save()
        self.assertEqual(self.video_asset.processing_status, 'processing')
        
        # Test completion
        self.video_asset.processing_status = 'completed'
        self.video_asset.save()
        self.assertEqual(self.video_asset.processing_status, 'completed')
    
    def test_video_asset_metadata(self):
        """Test VideoAsset metadata fields"""
        self.assertEqual(self.video_asset.duration_sec, 10)
        self.assertEqual(self.video_asset.width, 1920)
        self.assertEqual(self.video_asset.height, 1080)
    
    def test_video_asset_integrity_validation(self):
        """Test VideoAsset integrity validation"""
        # Test validation method
        validation_result = self.video_asset.validate_integrity()
        self.assertIsInstance(validation_result, dict)
        self.assertIn('is_valid', validation_result)
        self.assertIn('errors', validation_result)
        self.assertIn('warnings', validation_result)
        self.assertIn('timestamp', validation_result)


class ExerciseModelTest(TestCase):
    """Test Exercise model functionality"""
    
    def setUp(self):
        self.user = TestDataFactory.create_user()
        self.video_asset = TestDataFactory.create_video_asset()
        self.exercise = TestDataFactory.create_exercise(
            video_asset=self.video_asset,
            created_by=self.user
        )
    
    def test_exercise_creation(self):
        """Test Exercise creation with valid data"""
        self.assertIsNotNone(self.exercise.id)
        self.assertIn('Test Exercise', self.exercise.name)
        self.assertEqual(self.exercise.description, 'Test exercise description')
        self.assertEqual(self.exercise.created_by, self.user)
        self.assertEqual(self.exercise.video_asset, self.video_asset)
    
    def test_exercise_str_representation(self):
        """Test Exercise string representation"""
        expected_str = f"{self.exercise.name} by {self.user.username}"
        self.assertEqual(str(self.exercise), expected_str)
    
    def test_exercise_name_length_limit(self):
        """Test Exercise name length validation"""
        # Test with very long name
        long_name = 'A' * 300  # Assuming there's a max length
        exercise = TestDataFactory.create_exercise(
            name=long_name,
            video_asset=self.video_asset,
            created_by=self.user
        )
        self.assertEqual(exercise.name, long_name)
    
    def test_exercise_name_user_uniqueness(self):
        """Test Exercise name uniqueness per user"""
        # Create another exercise with same name but different user
        other_user = TestDataFactory.create_user()
        other_exercise = TestDataFactory.create_exercise(
            name=self.exercise.name,
            video_asset=self.video_asset,
            created_by=other_user
        )
        
        # Both should exist (names are unique per user, not globally)
        self.assertNotEqual(self.exercise.id, other_exercise.id)
        self.assertEqual(self.exercise.name, other_exercise.name)
    
    def test_exercise_video_asset_relationship(self):
        """Test Exercise relationship with VideoAsset"""
        self.assertEqual(self.exercise.video_asset, self.video_asset)
        self.assertEqual(self.exercise.video_asset.mime_type, 'video/mp4')
        self.assertEqual(self.exercise.video_asset.processing_status, 'completed')
    
    def test_exercise_created_by_relationship(self):
        """Test Exercise relationship with User"""
        self.assertEqual(self.exercise.created_by, self.user)
        self.assertTrue(self.user.is_active)
        self.assertFalse(self.user.is_staff)


class VideoCommentModelTest(TestCase):
    """Test VideoComment model functionality"""
    
    def setUp(self):
        self.user = TestDataFactory.create_user()
        self.video_asset = TestDataFactory.create_video_asset()
        self.exercise = TestDataFactory.create_exercise(
            video_asset=self.video_asset,
            created_by=self.user
        )
        self.comment = TestDataFactory.create_video_comment(
            exercise=self.exercise,
            author=self.user,
            video_asset=self.video_asset
        )
    
    def test_video_comment_creation(self):
        """Test VideoComment creation with valid data"""
        self.assertIsNotNone(self.comment.id)
        self.assertEqual(self.comment.exercise, self.exercise)
        self.assertEqual(self.comment.author, self.user)
        self.assertEqual(self.comment.video_asset, self.video_asset)
        self.assertEqual(self.comment.text, 'Test comment text')
    
    def test_video_comment_str_representation(self):
        """Test VideoComment string representation"""
        expected_str = f"Comment by {self.user.username} on {self.exercise.name}"
        self.assertEqual(str(self.comment), expected_str)
    
    def test_video_comment_with_optional_text(self):
        """Test VideoComment with optional text field"""
        comment_no_text = TestDataFactory.create_video_comment(
            exercise=self.exercise,
            author=self.user,
            video_asset=self.video_asset,
            text=''
        )
        self.assertEqual(comment_no_text.text, '')
    
    def test_video_comment_relationships(self):
        """Test VideoComment relationships"""
        # Test exercise relationship
        self.assertEqual(self.comment.exercise, self.exercise)
        self.assertEqual(self.comment.exercise.name, self.exercise.name)
        
        # Test author relationship
        self.assertEqual(self.comment.author, self.user)
        self.assertEqual(self.comment.author.username, self.user.username)
        
        # Test video asset relationship
        self.assertEqual(self.comment.video_asset, self.video_asset)
        self.assertEqual(self.comment.video_asset.mime_type, 'video/mp4')
    
    def test_video_comment_exercise_comments(self):
        """Test reverse relationship from Exercise to comments"""
        # Create another comment
        other_user = TestDataFactory.create_user()
        other_comment = TestDataFactory.create_video_comment(
            exercise=self.exercise,
            author=other_user,
            video_asset=self.video_asset
        )
        
        # Check that exercise has both comments
        exercise_comments = self.exercise.videocomment_set.all()
        self.assertEqual(exercise_comments.count(), 2)
        self.assertIn(self.comment, exercise_comments)
        self.assertIn(other_comment, exercise_comments)
    
    def test_video_comment_user_comments(self):
        """Test reverse relationship from User to comments"""
        # Create another comment by same user
        other_exercise = TestDataFactory.create_exercise(
            video_asset=self.video_asset,
            created_by=self.user
        )
        other_comment = TestDataFactory.create_video_comment(
            exercise=other_exercise,
            author=self.user,
            video_asset=self.video_asset
        )
        
        # Check that user has both comments
        user_comments = self.user.videocomment_set.all()
        self.assertEqual(user_comments.count(), 2)
        self.assertIn(self.comment, user_comments)
        self.assertIn(other_comment, user_comments)
