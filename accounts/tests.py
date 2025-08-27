from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from .models import Role, Profile


class AccountsTests(TestCase):
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        # Roles should be seeded by migration
        self.student_role = Role.objects.get(name='student')
        self.instructor_role = Role.objects.get(name='instructor')

    def test_signup_page_loads(self):
        """Test that signup page loads correctly."""
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Sign Up')

    def test_login_page_loads(self):
        """Test that login page loads correctly."""
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Login')

    def test_user_signup(self):
        """Test that user can sign up successfully."""
        data = {
            'action': 'signup',
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123'
        }
        response = self.client.post(reverse('exercises:login'), data)
        self.assertEqual(response.status_code, 302)  # Redirect after successful signup
        
        # Check that user was created
        user = User.objects.get(username='testuser')
        self.assertEqual(user.email, 'test@example.com')
        
        # Check that profile was created with student role (default)
        profile = Profile.objects.get(user=user)
        self.assertEqual(profile.role, self.student_role)

    def test_user_login(self):
        """Test that user can login successfully."""
        # Create a user first
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=user, role=self.student_role)
        
        # Test login
        data = {
            'action': 'login',
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post(reverse('exercises:login'), data)
        self.assertEqual(response.status_code, 302)  # Redirect after successful login
        
        # Check that user is logged in
        response = self.client.get(reverse('home'), follow=True)
        self.assertContains(response, 'Logout')  # Should show logout link when logged in