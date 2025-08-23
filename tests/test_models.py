import pytest
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from core.models import VideoAsset
from exercises.models import Exercise
from comments.models import VideoComment
from model_bakery import baker


class VideoAssetModelTest(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.video_asset = baker.make(VideoAsset)

    def test_video_asset_creation(self):
        """Test VideoAsset can be created with required fields"""
        video_asset = VideoAsset.objects.create(
            orig_filename="test.mp4",
            storage_path="/media/videos/test.mp4",
            mime_type="video/mp4",
            size_bytes=1024
        )
        self.assertIsNotNone(video_asset.id)
        self.assertEqual(video_asset.orig_filename, "test.mp4")
        self.assertEqual(video_asset.mime_type, "video/mp4")
        self.assertEqual(video_asset.size_bytes, 1024)

    def test_video_asset_checksum_auto_calculation(self):
        """Test that checksum is automatically calculated"""
        video_asset = VideoAsset.objects.create(
            orig_filename="test.mp4",
            storage_path="/media/videos/test.mp4",
            mime_type="video/mp4",
            size_bytes=1024
        )
        # Checksum should be calculated even if file doesn't exist
        self.assertEqual(len(video_asset.checksum_sha256), 64)

    def test_video_asset_str_representation(self):
        """Test string representation of VideoAsset"""
        video_asset = VideoAsset.objects.create(
            orig_filename="test.mp4",
            storage_path="/media/videos/test.mp4",
            mime_type="video/mp4",
            size_bytes=1024
        )
        self.assertIn("test.mp4", str(video_asset))
        self.assertIn(str(video_asset.id), str(video_asset))


class ExerciseModelTest(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.video_asset = baker.make(VideoAsset)

    def test_exercise_creation(self):
        """Test Exercise can be created with required fields"""
        exercise = Exercise.objects.create(
            name="Test Exercise",
            video_asset=self.video_asset,
            created_by=self.user
        )
        self.assertIsNotNone(exercise.id)
        self.assertEqual(exercise.name, "Test Exercise")
        self.assertEqual(exercise.video_asset, self.video_asset)
        self.assertEqual(exercise.created_by, self.user)

    def test_exercise_name_length_limit(self):
        """Test Exercise name respects 140 character limit"""
        long_name = "a" * 141
        with self.assertRaises(ValidationError):
            exercise = Exercise(
                name=long_name,
                video_asset=self.video_asset,
                created_by=self.user
            )
            exercise.full_clean()

    def test_exercise_name_user_uniqueness(self):
        """Test Exercise name is unique per created_by user"""
        # Create first exercise
        exercise1 = Exercise.objects.create(
            name="Unique Exercise",
            video_asset=self.video_asset,
            created_by=self.user
        )
        
        # Test that the same user cannot create another exercise with the same name
        # We'll test this by checking the model validation
        duplicate_exercise = Exercise(
            name="Unique Exercise",
            video_asset=self.video_asset,
            created_by=self.user
        )
        
        # The model should not validate due to uniqueness constraint
        with self.assertRaises(Exception):
            duplicate_exercise.full_clean()
            duplicate_exercise.save()
        
        # Different user, same name should work
        other_user = baker.make(User)
        other_video = baker.make(VideoAsset)
        exercise2 = Exercise.objects.create(
            name="Unique Exercise",
            video_asset=other_video,
            created_by=other_user
        )
        
        # Verify both exercises exist
        self.assertEqual(Exercise.objects.filter(name="Unique Exercise").count(), 2)

    def test_exercise_str_representation(self):
        """Test string representation of Exercise"""
        exercise = Exercise.objects.create(
            name="Test Exercise",
            video_asset=self.video_asset,
            created_by=self.user
        )
        self.assertIn("Test Exercise", str(exercise))
        self.assertIn(self.user.username, str(exercise))


class VideoCommentModelTest(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.video_asset = baker.make(VideoAsset)
        self.exercise = baker.make(Exercise, video_asset=self.video_asset, created_by=self.user)

    def test_video_comment_creation(self):
        """Test VideoComment can be created with required fields"""
        comment = VideoComment.objects.create(
            exercise=self.exercise,
            author=self.user,
            video_asset=self.video_asset
        )
        self.assertIsNotNone(comment.id)
        self.assertEqual(comment.exercise, self.exercise)
        self.assertEqual(comment.author, self.user)
        self.assertEqual(comment.video_asset, self.video_asset)

    def test_video_comment_with_optional_text(self):
        """Test VideoComment can be created with optional text"""
        comment = VideoComment.objects.create(
            exercise=self.exercise,
            author=self.user,
            video_asset=self.video_asset,
            text="This is a test comment"
        )
        self.assertEqual(comment.text, "This is a test comment")

    def test_video_comment_str_representation(self):
        """Test string representation of VideoComment"""
        comment = VideoComment.objects.create(
            exercise=self.exercise,
            author=self.user,
            video_asset=self.video_asset
        )
        self.assertIn(self.user.username, str(comment))
        self.assertIn(self.exercise.name, str(comment))
