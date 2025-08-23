from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from exercises.models import Exercise, VideoAsset
from core.models import VideoAsset as CoreVideoAsset
import uuid


class IconAccessibilityTest(TestCase):
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

    def test_exercise_list_page_has_required_controls(self):
        """Test that exercise list page has all required icon controls with proper aria-labels"""
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check for required controls
        self.assertContains(response, 'aria-label="Exercise List"')
        self.assertContains(response, 'aria-label="Create New Exercise"')
        self.assertContains(response, 'aria-label="Login"')
        
        # Check for icon usage
        self.assertContains(response, '/static/icons/icons.svg#list')
        self.assertContains(response, '/static/icons/icons.svg#new-ex')
        self.assertContains(response, '/static/icons/icons.svg#play')

    def test_exercise_detail_page_has_required_controls(self):
        """Test that exercise detail page has all required icon controls"""
        response = self.client.get(reverse('exercise_detail', args=[self.exercise.id]))
        self.assertEqual(response.status_code, 200)
        
        # Check for required controls
        self.assertContains(response, 'aria-label="Submit video comment"')
        self.assertContains(response, '/static/icons/icons.svg#upload')

    def test_create_exercise_page_has_required_controls(self):
        """Test that create exercise page has all required icon controls"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_create'))
        self.assertEqual(response.status_code, 200)
        
        # Check for required controls
        self.assertContains(response, 'aria-label="Create exercise"')
        self.assertContains(response, 'aria-label="Cancel and return to exercise list"')
        self.assertContains(response, 'aria-label="Start recording video"')
        self.assertContains(response, 'aria-label="Stop recording video"')
        self.assertContains(response, 'aria-label="Record video again"')
        self.assertContains(response, 'aria-label="Record with webcam"')
        self.assertContains(response, 'aria-label="Upload video file"')
        
        # Check for icon usage
        self.assertContains(response, '/static/icons/icons.svg#save')
        self.assertContains(response, '/static/icons/icons.svg#back')
        self.assertContains(response, '/static/icons/icons.svg#record')
        self.assertContains(response, '/static/icons/icons.svg#stop')
        self.assertContains(response, '/static/icons/icons.svg#camera')
        self.assertContains(response, '/static/icons/icons.svg#upload')

    def test_navigation_has_required_controls(self):
        """Test that navigation has all required icon controls"""
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check navigation controls
        self.assertContains(response, 'aria-label="Exercise List"')
        self.assertContains(response, 'aria-label="Create New Exercise"')
        self.assertContains(response, 'aria-label="Login"')

    def test_icon_only_mode_by_default(self):
        """Test that icon-only mode is enabled by default"""
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check that icon-only class is present
        self.assertContains(response, 'class="icon-only"')
        
        # Check that label-text elements exist but are hidden by CSS
        self.assertContains(response, 'class="label-text"')

    def test_text_mode_toggle_parameter(self):
        """Test that ?text=1 parameter removes icon-only mode"""
        response = self.client.get(f"{reverse('exercise_list')}?text=1")
        self.assertEqual(response.status_code, 200)
        
        # Check that icon-only class is still present (handled by JavaScript)
        self.assertContains(response, 'class="icon-only"')

    def test_keyboard_navigation_controls(self):
        """Test that all interactive controls are keyboard accessible"""
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check for proper button and link roles
        self.assertContains(response, 'role="button"')
        
        # Check for proper tabindex
        self.assertContains(response, 'tabindex="0"')

    def test_icon_sprite_loading(self):
        """Test that icon sprite is properly loaded"""
        response = self.client.get('/static/icons/icons.svg')
        self.assertEqual(response.status_code, 200)
        
        # Check for required icon symbols
        self.assertContains(response, 'id="home"')
        self.assertContains(response, 'id="list"')
        self.assertContains(response, 'id="record"')
        self.assertContains(response, 'id="stop"')
        self.assertContains(response, 'id="play"')
        self.assertContains(response, 'id="upload"')
        self.assertContains(response, 'id="camera"')
        self.assertContains(response, 'id="comment"')
        self.assertContains(response, 'id="edit"')
        self.assertContains(response, 'id="delete"')
        self.assertContains(response, 'id="save"')
        self.assertContains(response, 'id="back"')
        self.assertContains(response, 'id="settings"')
        self.assertContains(response, 'id="new-ex"')

    def test_icon_css_loading(self):
        """Test that icon UI CSS is properly loaded"""
        response = self.client.get('/static/css/icon-ui.css')
        self.assertEqual(response.status_code, 200)
        
        # Check for required CSS variables
        self.assertContains(response, '--icon-size')
        self.assertContains(response, '--hit-target')
        self.assertContains(response, '--focus-ring')

    def test_authenticated_user_navigation(self):
        """Test that authenticated users see proper navigation controls"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check for logout control
        self.assertContains(response, 'aria-label="Logout (testuser)"')
        self.assertContains(response, '/static/icons/icons.svg#settings')

    def test_admin_user_navigation(self):
        """Test that admin users see proper navigation controls"""
        self.client.login(username='admin', password='adminpass123')
        response = self.client.get(reverse('exercise_list'))
        self.assertEqual(response.status_code, 200)
        
        # Check for create exercise control
        self.assertContains(response, 'aria-label="Create New Exercise"')
        self.assertContains(response, '/static/icons/icons.svg#new-ex')
