"""
Tests for video comments functionality.
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from exercises.models import Exercise
from comments.models import VideoComment
from core.models import VideoAsset


class VideoCommentsTests(TestCase):
    """Test video comments functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123'
        )
        
        # Create test video file
        self.test_video = SimpleUploadedFile(
            "test_video.mp4",
            b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp41mp42isom",
            content_type="video/mp4"
        )
        
        # Create video asset for exercise first
        self.exercise_video = VideoAsset.objects.create(
            orig_filename='exercise_video.mp4',
            storage_path='videos/exercise_video.mp4',
            mime_type='video/mp4',
            size_bytes=1024,
            checksum_sha256='test_checksum'
        )
        
        # Create test exercise with video
        self.exercise = Exercise.objects.create(
            name='Test Exercise',
            description='Test Description',
            created_by=self.user,
            video_asset=self.exercise_video
        )
    
    def test_text_only_comment_creation(self):
        """Test creating a text-only comment."""
        self.client.login(username='testuser', password='testpass123')
        
        response = self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {'text': 'This is a text comment'}
        )
        
        self.assertEqual(response.status_code, 302)
        
        # Check that comment was created
        comment = VideoComment.objects.get(exercise=self.exercise)
        self.assertEqual(comment.text, 'This is a text comment')
        self.assertIsNone(comment.video_asset)
        self.assertEqual(comment.author, self.user)
    
    def test_video_only_comment_creation(self):
        """Test creating a video-only comment."""
        self.client.login(username='testuser', password='testpass123')
        
        response = self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {'video': self.test_video}
        )
        
        self.assertEqual(response.status_code, 302)
        
        # Check that comment was created
        comment = VideoComment.objects.get(exercise=self.exercise)
        self.assertIsNone(comment.text)
        self.assertIsNotNone(comment.video_asset)
        self.assertEqual(comment.author, self.user)
    
    def test_text_and_video_comment_creation(self):
        """Test creating a comment with both text and video."""
        self.client.login(username='testuser', password='testpass123')
        
        response = self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {
                'text': 'This is a comment with video',
                'video': self.test_video
            }
        )
        
        self.assertEqual(response.status_code, 302)
        
        # Check that comment was created
        comment = VideoComment.objects.get(exercise=self.exercise)
        self.assertEqual(comment.text, 'This is a comment with video')
        self.assertIsNotNone(comment.video_asset)
        self.assertEqual(comment.author, self.user)
    
    def test_empty_comment_rejection(self):
        """Test that empty comments are rejected."""
        self.client.login(username='testuser', password='testpass123')
        
        response = self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {}
        )
        
        self.assertEqual(response.status_code, 302)
        
        # Check that no comment was created
        self.assertEqual(VideoComment.objects.filter(exercise=self.exercise).count(), 0)
    
    def test_multiple_comments_per_exercise(self):
        """Test that multiple comments can be added to an exercise."""
        self.client.login(username='testuser', password='testpass123')
        
        # Create first comment
        self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {'text': 'First comment'}
        )
        
        # Create second comment
        self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {'text': 'Second comment'}
        )
        
        # Check that both comments were created
        comments = VideoComment.objects.filter(exercise=self.exercise)
        self.assertEqual(comments.count(), 2)
        self.assertEqual(comments[0].text, 'Second comment')  # Most recent first
        self.assertEqual(comments[1].text, 'First comment')
    
    def test_comment_display_in_exercise_detail(self):
        """Test that comments are displayed in exercise detail view."""
        # Create a comment
        VideoComment.objects.create(
            exercise=self.exercise,
            author=self.user,
            text='Test comment text'
        )
        
        response = self.client.get(
            reverse('exercises:exercise_detail', args=[self.exercise.id])
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Test comment text')
        self.assertContains(response, 'testuser')
    
    def test_video_comment_display(self):
        """Test that video comments are displayed correctly."""
        # Create a video comment
        comment = VideoComment.objects.create(
            exercise=self.exercise,
            author=self.user,
            text='Video comment',
            video_asset=self.exercise_video
        )
        
        response = self.client.get(
            reverse('exercises:exercise_detail', args=[self.exercise.id])
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Video comment')
        self.assertContains(response, 'video controls')
    
    def test_unauthenticated_user_cannot_comment(self):
        """Test that unauthenticated users cannot add comments."""
        response = self.client.post(
            reverse('comments:add_comment', args=[self.exercise.id]),
            {'text': 'Unauthorized comment'}
        )
        
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.url)
        
        # Check that no comment was created
        self.assertEqual(VideoComment.objects.filter(exercise=self.exercise).count(), 0)
