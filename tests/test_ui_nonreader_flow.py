from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from exercises.models import Exercise, VideoAsset
from core.models import VideoAsset as CoreVideoAsset
from comments.models import VideoComment
import uuid
import tempfile
import os


class NonReaderUIFlowTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            is_staff=True
        )
        
        # Create a test video asset
        self.video_asset = CoreVideoAsset.objects.create(
            id=uuid.uuid4(),
            orig_filename='test.mp4',
            mime_type='video/mp4',
            size_bytes=1024000,
            duration_sec=30,
            storage_path='videos/test.mp4',
            checksum_sha256='a' * 64,  # Mock checksum
            processing_status='completed',
            is_valid=True
        )
        
        # Create a test exercise
        self.exercise = Exercise.objects.create(
            id=uuid.uuid4(),
            name='Test Exercise',
            description='Test exercise description',
            created_by=self.admin_user,
            video_asset=self.video_asset
        )

    def test_icon_only_form_submission_creates_exercise(self):
        """Test that icon-only form submission creates exercise correctly"""
        self.client.login(username='admin', password='adminpass123')
        
        # Create a temporary video file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
            temp_file.write(b'fake video content')
            temp_file_path = temp_file.name
        
        try:
            with open(temp_file_path, 'rb') as video_file:
                response = self.client.post(reverse('exercise_create'), {
                    'name': 'Icon Test Exercise',
                    'description': 'Test exercise created via icon-only UI',
                    'video': video_file,
                }, follow=True)
            
            # Check that exercise was created
            self.assertEqual(response.status_code, 200)
            exercise = Exercise.objects.filter(name='Icon Test Exercise').first()
            self.assertIsNotNone(exercise)
            
            # Check redirect to exercise detail
            self.assertIn('exercise_detail', response.redirect_chain[-1][0])
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    def test_icon_only_comment_form_submission(self):
        """Test that icon-only comment form submission works correctly"""
        self.client.login(username='testuser', password='testpass123')
        
        # Create a temporary video file for comment
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_file:
            temp_file.write(b'fake comment video content')
            temp_file_path = temp_file.name
        
        try:
            with open(temp_file_path, 'rb') as video_file:
                response = self.client.post('/api/video-comments/', {
                    'exercise_id': str(self.exercise.id),
                    'text': 'Test comment via icon-only UI',
                    'video': video_file,
                }, follow=True)
            
            # Check that comment was created
            self.assertEqual(response.status_code, 200)
            comment = VideoComment.objects.filter(
                exercise=self.exercise,
                author=self.user,
                text='Test comment via icon-only UI'
            ).first()
            self.assertIsNotNone(comment)
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    def test_icon_only_navigation_flow(self):
        """Test that icon-only navigation flow works correctly"""
        self.client.login(username='admin', password='adminpass123')
        
        # Navigate through the app using icon-only UI
        # 1. Start at exercise list
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="icon-only"')
        
        # 2. Navigate to create exercise
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '/static/icons/icons.svg#save')
        self.assertContains(response, '/static/icons/icons.svg#back')
        
        # 3. Navigate back to exercise list
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '/static/icons/icons.svg#new-ex')

    def test_icon_only_recording_controls(self):
        """Test that icon-only recording controls are properly configured"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        
        # Check recording control icons
        self.assertContains(response, '/static/icons/icons.svg#record')
        self.assertContains(response, '/static/icons/icons.svg#stop')
        self.assertContains(response, '/static/icons/icons.svg#camera')
        
        # Check aria-labels for accessibility
        self.assertContains(response, 'aria-label="Start recording video"')
        self.assertContains(response, 'aria-label="Stop recording video"')
        self.assertContains(response, 'aria-label="Record video again"')

    def test_icon_only_form_validation(self):
        """Test that icon-only forms maintain proper validation"""
        self.client.login(username='admin', password='adminpass123')
        
        # Try to submit form without required fields
        response = self.client.post(reverse('exercise_create'), {
            'description': 'Missing name field',
        })
        
        # Should get validation error
        self.assertEqual(response.status_code, 200)
        # Form should still be displayed with errors

    def test_icon_only_upload_progress(self):
        """Test that icon-only upload progress indicators work"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        
        # Check progress step icons
        self.assertContains(response, 'id="upload-step-1"')
        self.assertContains(response, 'id="upload-step-2"')
        self.assertContains(response, 'id="upload-step-3"')
        self.assertContains(response, 'id="upload-step-4"')

    def test_icon_only_video_source_toggle(self):
        """Test that icon-only video source toggle works correctly"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        
        # Check toggle button icons
        self.assertContains(response, '/static/icons/icons.svg#camera')
        self.assertContains(response, '/static/icons/icons.svg#upload')
        
        # Check aria-labels
        self.assertContains(response, 'aria-label="Record with webcam"')
        self.assertContains(response, 'aria-label="Upload video file"')

    def test_icon_only_comment_progress(self):
        """Test that icon-only comment progress indicators work"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('exercise_detail', args=[self.exercise.id]))
        self.assertEqual(response.status_code, 200)
        
        # Check comment progress steps
        self.assertContains(response, 'id="comment-step-1-main"')
        self.assertContains(response, 'id="comment-step-2-main"')
        self.assertContains(response, 'id="comment-step-3-main"')

    def test_icon_only_form_structure_preserved(self):
        """Test that icon-only forms maintain the same structure and endpoints"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        
        # Check that form action and method are preserved
        self.assertContains(response, 'enctype="multipart/form-data"')
        self.assertContains(response, 'id="exercise-form"')
        
        # Check that CSRF token is present
        self.assertContains(response, 'name="csrfmiddlewaretoken"')

    def test_icon_only_button_states(self):
        """Test that icon-only buttons maintain proper states"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        
        # Check button states
        self.assertContains(response, 'id="start-recording"')
        self.assertContains(response, 'id="stop-recording"')
        self.assertContains(response, 'id="reset-recording"')
        
        # Check that stop and reset buttons are hidden by default
        self.assertContains(response, 'class="btn btn-danger btn-large hidden"')
        self.assertContains(response, 'class="btn btn-secondary hidden"')

    def test_icon_only_accessibility_features(self):
        """Test that icon-only UI maintains accessibility features"""
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check for proper ARIA labels
        self.assertContains(response, 'aria-label=')
        self.assertContains(response, 'title=')
        
        # Check for screen reader support
        self.assertContains(response, 'class="label-text"')
        
        # Check for icon legend toggle
        self.assertContains(response, 'aria-label="Show icon meanings"')
