from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.core import mail
import re
from .models import Role, Profile, BetaInvitation


class AccountsTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Create roles if they don't exist (will be created when needed)
        invitation = BetaInvitation.objects.create(email='invite@example.com')
        self.client.get(reverse('exercises:login') + f'?token={invitation.token}')

    def test_signup_page_loads(self):
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Sign Up')

    def test_login_page_loads(self):
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Login')

    def test_user_signup(self):
        """Test user signup with MVP approach."""
        # Create roles if they don't exist
        student_role, created = Role.objects.get_or_create(name='student')
        
        data = {
            'action': 'signup',
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123',
            'role': 'student'
        }
        response = self.client.post(reverse('exercises:login'), data)
        self.assertEqual(response.status_code, 302)

        user = User.objects.get(username='testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.is_active)  # MVP approach - user is active immediately

        profile = Profile.objects.get(user=user)
        self.assertEqual(profile.role, student_role)

    def test_user_login(self):
        # Create roles if they don't exist
        student_role, created = Role.objects.get_or_create(name='student')
        
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        profile = Profile.objects.create(user=user, role=student_role)
        # No email verification needed in MVP approach

        data = {
            'action': 'login',
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post(reverse('exercises:login'), data)
        self.assertEqual(response.status_code, 302)

        response = self.client.get(reverse('home'), follow=True)
        self.assertContains(response, 'Logout')  # Should show logout link when logged in

    def test_user_signup_simple(self):
        """Test user signup with MVP approach - simple version."""
        # Test that the signup form is accessible
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Sign Up')
        self.assertContains(response, 'role')
        
        # Test that the signup form has the required fields
        self.assertContains(response, 'username')
        self.assertContains(response, 'email')
        self.assertContains(response, 'password1')
        self.assertContains(response, 'password2')


class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='pwuser', email='pw@example.com', password='oldpassword'
        )

    def test_request_password_reset(self):
        response = self.client.post(
            reverse('accounts:password_reset'), {'email': 'pw@example.com'}
        )
        self.assertRedirects(response, reverse('accounts:password_reset_done'))
        self.assertEqual(len(mail.outbox), 1)

    def test_password_reset_confirm(self):
        mail.outbox = []
        self.client.post(
            reverse('accounts:password_reset'), {'email': 'pw@example.com'}
        )
        url = re.search(r"http://testserver(.+)", mail.outbox[0].body).group(1)
        response = self.client.get(url)
        post_url = response.url
        response = self.client.post(
            post_url,
            {
                'new_password1': 'newpass456',
                'new_password2': 'newpass456',
            },
        )
        self.assertRedirects(response, reverse('accounts:password_reset_complete'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newpass456'))

