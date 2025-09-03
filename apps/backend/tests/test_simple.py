"""
Simple test to verify basic functionality works
"""
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User


class SimpleTest(TestCase):
    """Simple test to verify basic functionality"""
    
    def test_home_page_loads(self):
        """Test that home page loads"""
        response = self.client.get('/')
        self.assertIn(response.status_code, [200, 302])  # Either loads or redirects
    
    def test_login_page_loads(self):
        """Test that login page loads"""
        response = self.client.get('/exercises/login/')
        self.assertEqual(response.status_code, 200)
    
    def test_user_creation(self):
        """Test that users can be created"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
