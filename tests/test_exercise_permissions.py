"""
Tests for exercise creation permissions to ensure all authenticated users can create exercises.
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from exercises.models import Exercise
from core.models import VideoAsset


class ExercisePermissionTests(TestCase):
    """Test exercise creation permissions - all authenticated users can create."""
    
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        
        # Create staff user
        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@test.com',
            password='testpass123',
            is_staff=True
        )
        
        # Create regular user
        self.regular_user = User.objects.create_user(
            username='regular',
            email='regular@test.com',
            password='testpass123',
            is_staff=False
        )
        
        # Create test video file with proper video content
        self.test_video = SimpleUploadedFile(
            "test_video.mp4",
            b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp41mp42isom",
            content_type="video/mp4"
        )
    
    def test_staff_can_access_create_page(self):
        """Test that staff users can access the exercise creation page."""
        self.client.login(username='staff', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_create'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Create New Exercise')
    
    def test_regular_user_can_access_create_page(self):
        """Test that regular users can access the exercise creation page."""
        self.client.login(username='regular', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_create'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Create New Exercise')
    
    def test_staff_can_create_exercise(self):
        """Test that staff users can successfully create exercises."""
        self.client.login(username='staff', password='testpass123')
        
        response = self.client.post(reverse('exercises:exercise_create'), {
            'name': 'Test Exercise',
            'description': 'Test Description',
            'video': self.test_video
        })
        
        # Should redirect to exercise detail on success
        self.assertEqual(response.status_code, 302)
        
        # Check that exercise was created
        exercise = Exercise.objects.get(name='Test Exercise')
        self.assertEqual(exercise.created_by, self.staff_user)
        self.assertEqual(exercise.name, 'Test Exercise')
    
    def test_regular_user_can_create_exercise_via_post(self):
        """Test that regular users can create exercises via POST."""
        self.client.login(username='regular', password='testpass123')
        
        response = self.client.post(reverse('exercises:exercise_create'), {
            'name': 'Test Exercise',
            'description': 'Test Description',
            'video': self.test_video
        })
        
        # Should redirect to exercise detail on success
        self.assertEqual(response.status_code, 302)
        
        # Check that exercise was created
        exercise = Exercise.objects.get(name='Test Exercise')
        self.assertEqual(exercise.created_by, self.regular_user)
        self.assertEqual(exercise.name, 'Test Exercise')
    
    def test_unauthenticated_user_redirected_to_login(self):
        """Test that unauthenticated users are redirected to login."""
        response = self.client.get(reverse('exercises:exercise_create'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.url)
    
    def test_navigation_shows_create_button_for_all_users(self):
        """Test that create button shows for all authenticated users."""
        # Test staff user
        self.client.login(username='staff', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_list'))
        self.assertContains(response, 'Create New Exercise')
        
        # Test regular user
        self.client.login(username='regular', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_list'))
        self.assertContains(response, 'Create New Exercise')
