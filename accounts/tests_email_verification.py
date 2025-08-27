"""
Comprehensive tests for email verification system.
"""
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from django.core import mail
from django.utils import timezone
from django.core.cache import cache
from unittest.mock import patch, MagicMock
import json
import time

from .models import Profile, Role
from .email_verification import email_verification_token


class EmailVerificationTests(TestCase):
    """Test email verification functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        
        # Get existing roles (seeded by migration)
        self.student_role = Role.objects.get(name='student')
        
        # Create test user (inactive, unverified)
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            is_active=False
        )
        Profile.objects.create(user=self.user, role=self.student_role)
        
        # Clear cache
        cache.clear()
    
    def test_new_signup_creates_inactive_user(self):
        """Test that new signup creates inactive user."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123'
        }

        response = self.client.post(reverse('accounts:signup'), data)
        self.assertEqual(response.status_code, 302)
        
        # Check user was created as inactive
        user = User.objects.get(username='newuser')
        self.assertFalse(user.is_active)
        self.assertFalse(user.profile.is_email_verified())
    
    @patch('accounts.views.send_verification_email')
    def test_signup_sends_verification_email(self, mock_send_email):
        """Test that signup triggers verification email."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123'
        }

        response = self.client.post(reverse('accounts:signup'), data)
        self.assertEqual(response.status_code, 302)
        
        # Check that verification email was queued
        mock_send_email.delay.assert_called_once()
    
    def test_verification_success(self):
        """Test successful email verification."""
        # Generate valid token
        token = email_verification_token.generate_token(self.user)
        
        # Verify email
        response = self.client.get(
            reverse('accounts:verify_email'),
            {'uid': self.user.pk, 'token': token}
        )
        
        self.assertEqual(response.status_code, 302)
        self.assertIn('verified', response.url)
        
        # Check user is now active and verified
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.profile.is_email_verified())
    
    def test_verification_expired_token(self):
        """Test verification with expired token."""
        # Generate token and manually expire it
        token = email_verification_token.generate_token(self.user)
        
        # Mock time to make token expired
        with patch('accounts.email_verification.time.time', return_value=time.time() + 25*3600):
            response = self.client.get(
                reverse('accounts:verify_email'),
                {'uid': self.user.pk, 'token': token}
            )
        
        self.assertEqual(response.status_code, 302)
        self.assertIn('invalid_or_expired', response.url)
        
        # Check user is still inactive
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertFalse(self.user.profile.is_email_verified())
    
    def test_verification_tampered_token(self):
        """Test verification with tampered token."""
        # Generate valid token and tamper with it
        token = email_verification_token.generate_token(self.user)
        tampered_token = token[:-5] + 'XXXXX'
        
        response = self.client.get(
            reverse('accounts:verify_email'),
            {'uid': self.user.pk, 'token': tampered_token}
        )
        
        self.assertEqual(response.status_code, 302)
        self.assertIn('invalid_or_expired', response.url)
        
        # Check user is still inactive
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertFalse(self.user.profile.is_email_verified())
    
    def test_verification_wrong_user(self):
        """Test verification with token for different user."""
        # Create another user
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123',
            is_active=False
        )
        
        # Generate token for other user
        token = email_verification_token.generate_token(other_user)
        
        # Try to verify with current user's ID
        response = self.client.get(
            reverse('accounts:verify_email'),
            {'uid': self.user.pk, 'token': token}
        )
        
        self.assertEqual(response.status_code, 302)
        self.assertIn('invalid_or_expired', response.url)
    
    def test_cannot_login_before_verify(self):
        """Test that unverified users cannot login."""
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }

        response = self.client.post(reverse('accounts:login'), data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Please verify your email address')
    
    def test_can_login_after_verify(self):
        """Test that verified users can login."""
        # Verify user first
        self.user.profile.verify_email()
        
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }

        response = self.client.post(reverse('accounts:login'), data)
        self.assertEqual(response.status_code, 302)
    
    def test_resend_verification_success(self):
        """Test successful resend verification."""
        data = {'email': 'test@example.com'}
        
        with patch('accounts.views.send_verification_email') as mock_send:
            response = self.client.post(
                reverse('accounts:resend_verification'),
                data
            )
        
        if response.status_code != 200:
            print(f"Response status: {response.status_code}")
            print(f"Response content: {response.content.decode()}")
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('message', response_data)
        mock_send.delay.assert_called_once_with(self.user.pk)
    
    @patch('accounts.views.send_verification_email')
    def test_resend_verification_throttling_hourly(self, mock_send):
        """Test hourly rate limiting for resend verification."""
        data = {'email': 'test@example.com'}
        
        # Make 3 requests (should be allowed)
        for i in range(3):
            response = self.client.post(
                reverse('accounts:resend_verification'),
                data,

            )
            self.assertEqual(response.status_code, 200)
        
        # 4th request should be throttled
        response = self.client.post(
            reverse('accounts:resend_verification'),
            data
        )
        self.assertEqual(response.status_code, 429)
        response_data = json.loads(response.content)
        self.assertIn('Too many requests', response_data['error'])
    
    @patch('accounts.views.send_verification_email')
    def test_resend_verification_throttling_daily(self, mock_send):
        """Test daily rate limiting for resend verification."""
        data = {'email': 'test@example.com'}
        
        # Mock cache to simulate daily limit reached
        with patch('django.core.cache.cache.get') as mock_get:
            def mock_cache_get(key, default=None):
                return 10 if 'daily' in key else 0
            mock_get.side_effect = mock_cache_get
            
            response = self.client.post(
                reverse('accounts:resend_verification'),
                data,

            )
        
        self.assertEqual(response.status_code, 429)
        response_data = json.loads(response.content)
        self.assertIn('Daily limit reached', response_data['error'])
    
    @patch('accounts.views.send_verification_email')
    def test_resend_verification_nonexistent_email(self, mock_send):
        """Test resend verification with non-existent email."""
        data = {'email': 'nonexistent@example.com'}
        
        response = self.client.post(
            reverse('accounts:resend_verification'),
            data
        )
        
        # Should return success message (don't leak if email exists)
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('message', response_data)
    
    @patch('accounts.views.send_verification_email')
    def test_resend_verification_already_verified(self, mock_send):
        """Test resend verification for already verified user."""
        # Verify user first
        self.user.profile.verify_email()
        
        data = {'email': 'test@example.com'}
        
        response = self.client.post(
            reverse('accounts:resend_verification'),
            data
        )
        
        # Should return success message (don't leak verification status)
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        self.assertIn('message', response_data)
    
    def test_verification_idempotent_behavior(self):
        """Test that verification is idempotent."""
        # Verify user first
        self.user.profile.verify_email()
        original_verified_at = self.user.profile.email_verified_at
        
        # Generate token and try to verify again
        token = email_verification_token.generate_token(self.user)
        
        response = self.client.get(
            reverse('accounts:verify_email'),
            {'uid': self.user.pk, 'token': token}
        )
        
        # Should redirect to invalid/expired since already verified
        self.assertEqual(response.status_code, 302)
        self.assertIn('invalid_or_expired', response.url)
        
        # Check verification timestamp hasn't changed
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.email_verified_at, original_verified_at)
    
    def test_email_verification_token_generation(self):
        """Test token generation and verification."""
        # Generate token
        token = email_verification_token.generate_token(self.user)
        self.assertIsNotNone(token)
        
        # Verify token
        self.assertTrue(email_verification_token.verify_token(token, self.user))
        
        # Test with wrong user
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123',
            is_active=False
        )
        self.assertFalse(email_verification_token.verify_token(token, other_user))
    
    def test_verification_ui_banners(self):
        """Test verification status banners in UI."""
        # Test verified banner
        response = self.client.get(reverse('accounts:login') + '?m=verified')
        self.assertContains(response, 'Email verified successfully')
        
        # Test invalid/expired banner
        response = self.client.get(reverse('accounts:login') + '?m=invalid_or_expired')
        self.assertContains(response, 'Invalid or expired verification link')
        
        # Test resent banner
        response = self.client.get(reverse('accounts:login') + '?m=resent')
        self.assertContains(response, 'Verification email sent')
    
    def test_unique_email_enforcement(self):
        """Test that unique email constraint is enforced."""
        # Try to create user with existing email
        data = {
            'username': 'anotheruser',
            'email': 'test@example.com',  # Same email as existing user
            'password1': 'testpass123',
            'password2': 'testpass123'
        }

        response = self.client.post(reverse('accounts:signup'), data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Email already exists')
        
        # Check no new user was created
        self.assertEqual(User.objects.filter(email='test@example.com').count(), 1)
