"""
Tests for exercise creation permissions to ensure staff-only access.
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from exercises.models import Exercise
from core.models import VideoAsset


class ExercisePermissionTests(TestCase):
    """Test exercise creation permissions."""
    
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
    
    def test_regular_user_redirected_from_create_page(self):
        """Test that regular users are redirected from exercise creation page."""
        self.client.login(username='regular', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_create'))
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('exercises:exercise_list'))
    
    def test_regular_user_gets_error_message(self):
        """Test that regular users get an error message when trying to create."""
        self.client.login(username='regular', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_create'), follow=True)
        self.assertContains(response, 'Only staff users can create exercises')
    
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
    
    def test_regular_user_cannot_create_exercise_via_post(self):
        """Test that regular users cannot create exercises via POST."""
        self.client.login(username='regular', password='testpass123')
        
        response = self.client.post(reverse('exercises:exercise_create'), {
            'name': 'Test Exercise',
            'description': 'Test Description',
            'video': self.test_video
        })
        
        # Should redirect to exercise list
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('exercises:exercise_list'))
        
        # Check that no exercise was created
        self.assertEqual(Exercise.objects.count(), 0)
    
    def test_unauthenticated_user_redirected_to_login(self):
        """Test that unauthenticated users are redirected to login."""
        response = self.client.get(reverse('exercises:exercise_create'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.url)
    
    def test_navigation_shows_create_button_for_staff_only(self):
        """Test that create button only shows for staff users."""
        # Test staff user
        self.client.login(username='staff', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_list'))
        self.assertContains(response, 'Create Exercise')
        
        # Test regular user
        self.client.login(username='regular', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_list'))
        self.assertNotContains(response, 'Create Exercise')
    
    def test_exercise_list_shows_appropriate_message_for_regular_users(self):
        """Test that regular users see appropriate message when no exercises exist."""
        self.client.login(username='regular', password='testpass123')
        response = self.client.get(reverse('exercises:exercise_list'))
        self.assertContains(response, 'Only staff users can create exercises')
        self.assertContains(response, 'Contact an administrator')
