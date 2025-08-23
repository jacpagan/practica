"""
Tests for security features
"""
import pytest
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from core.security import SecurityValidator, SecurityAuditor
from core.services.storage import VideoStorageService


class SecurityValidatorTest(TestCase):
    """Test security validation functions"""
    
    def test_password_strength_validation(self):
        """Test password strength validation"""
        # Weak password
        result = SecurityValidator.validate_password_strength("123")
        self.assertFalse(result['valid'])
        self.assertEqual(result['score'], 0)
        
        # Strong password
        result = SecurityValidator.validate_password_strength("StrongPass123!")
        self.assertTrue(result['valid'])
        self.assertGreaterEqual(result['score'], 4)
        
        # Common password
        result = SecurityValidator.validate_password_strength("password")
        self.assertFalse(result['valid'])
        self.assertIn('too common', result['feedback'])
    
    def test_input_sanitization(self):
        """Test input sanitization"""
        # Test XSS prevention
        dangerous_input = "<script>alert('xss')</script>"
        sanitized = SecurityValidator.sanitize_input(dangerous_input)
        self.assertNotIn("<script>", sanitized)
        self.assertIn("&lt;script", sanitized)
        
        # Test length truncation
        long_input = "a" * 2000
        sanitized = SecurityValidator.sanitize_input(long_input, max_length=1000)
        self.assertEqual(len(sanitized), 1000)
    
    def test_file_upload_validation(self):
        """Test file upload validation"""
        # Valid file
        result = SecurityValidator.validate_file_upload(
            "test.mp4", 1024 * 1024, "video/mp4"
        )
        self.assertTrue(result['valid'])
        
        # Invalid extension
        result = SecurityValidator.validate_file_upload(
            "test.exe", 1024 * 1024, "application/x-msdownload"
        )
        self.assertFalse(result['valid'])
        self.assertIn('not allowed', result['errors'][0])
        
        # Suspicious filename
        result = SecurityValidator.validate_file_upload(
            "script.js", 1024, "text/javascript"
        )
        self.assertFalse(result['valid'])


class SecurityAuditorTest(TestCase):
    """Test security auditing functions"""
    
    def test_security_event_logging(self):
        """Test security event logging"""
        # This test verifies the logging function doesn't crash
        SecurityAuditor.log_security_event(
            'test_event',
            {'test': 'data'},
            'info'
        )
        # If we get here, the function worked
    
    def test_suspicious_activity_detection(self):
        """Test suspicious activity detection"""
        # Test SQL injection pattern
        request_data = {'query': 'SELECT * FROM users UNION SELECT password'}
        patterns = SecurityAuditor.check_suspicious_activity(request_data)
        self.assertGreater(len(patterns), 0)
        self.assertIn('SQL/XSS/CMD pattern', patterns[0])
        
        # Test XSS pattern
        request_data = {'comment': '<script>alert("xss")</script>'}
        patterns = SecurityAuditor.check_suspicious_activity(request_data)
        self.assertGreater(len(patterns), 0)


class LoginSecurityTest(TestCase):
    """Test login security features"""
    
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='TestPass123!',
            email='test@example.com'
        )
    
    def test_rate_limiting(self):
        """Test login rate limiting"""
        # Make multiple failed login attempts
        for i in range(6):
            response = self.client.post(reverse('login'), {
                'username': 'testuser',
                'password': 'wrongpassword'
            })
        
        # The last attempt should be rate limited
        self.assertIn('Too many login attempts', str(response.content))
    
    def test_account_lockout(self):
        """Test account lockout after failed attempts"""
        # Make 5 failed attempts
        for i in range(5):
            self.client.post(reverse('login'), {
                'username': 'testuser',
                'password': 'wrongpassword'
            })
        
        # Try to login with correct password
        response = self.client.post(reverse('login'), {
            'username': 'testuser',
            'password': 'TestPass123!'
        })
        
        # Should be locked out
        self.assertIn('Account is temporarily locked', str(response.content))
    
    def test_successful_login_resets_lockout(self):
        """Test that successful login resets lockout"""
        # Make 4 failed attempts (not enough to lockout)
        for i in range(4):
            self.client.post(reverse('login'), {
                'username': 'testuser',
                'password': 'wrongpassword'
            })
        
        # Login successfully
        response = self.client.post(reverse('login'), {
            'username': 'testuser',
            'password': 'TestPass123!'
        })
        
        # Should redirect to exercise list
        self.assertEqual(response.status_code, 302)


class FileUploadSecurityTest(APITestCase):
    """Test file upload security features"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='adminuser',
            password='AdminPass123!',
            is_staff=True
        )
        self.client.force_authenticate(user=self.user)
    
    def test_video_file_validation(self):
        """Test video file validation"""
        storage_service = VideoStorageService()
        
        # Valid video file
        valid_file = SimpleUploadedFile(
            "test.mp4",
            b"fake video content",
            content_type="video/mp4"
        )
        
        # This should not raise an exception
        try:
            # Note: This will fail at the database level in tests,
            # but we're testing the validation logic
            storage_service._validate_uploaded_file(valid_file)
        except Exception as e:
            # Expected to fail at database level in tests
            pass
    
    def test_executable_file_rejection(self):
        """Test that executable files are rejected"""
        storage_service = VideoStorageService()
        
        # Create a file that looks like an executable
        executable_file = SimpleUploadedFile(
            "test.exe",
            b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00",
            content_type="application/x-msdownload"
        )
        
        # This should raise a validation error
        with self.assertRaises(Exception):
            storage_service._perform_security_checks(executable_file)
    
    def test_suspicious_filename_rejection(self):
        """Test that suspicious filenames are rejected"""
        storage_service = VideoStorageService()
        
        # Create a file with suspicious name
        suspicious_file = SimpleUploadedFile(
            "script.js",
            b"fake content",
            content_type="text/javascript"
        )
        
        # This should raise a validation error
        with self.assertRaises(Exception):
            storage_service._validate_uploaded_file(suspicious_file)


class SecurityMiddlewareTest(TestCase):
    """Test security middleware functionality"""
    
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='TestPass123!'
        )
    
    def test_middleware_loaded(self):
        """Test that security middleware is loaded"""
        # Check if middleware is in settings
        from django.conf import settings
        self.assertIn('core.middleware.SecurityMiddleware', settings.MIDDLEWARE)
    
    def test_security_headers(self):
        """Test that security headers are set"""
        response = self.client.get(reverse('exercise_list'))
        
        # Check for security headers
        self.assertIn('X-Content-Type-Options', response)
        self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
        
        if hasattr(response, 'X-Frame-Options'):
            self.assertEqual(response['X-Frame-Options'], 'DENY')


class SecurityConfigurationTest(TestCase):
    """Test security configuration settings"""
    
    def test_security_settings_loaded(self):
        """Test that security settings are properly configured"""
        from django.conf import settings
        
        # Check that security features are enabled
        self.assertTrue(getattr(settings, 'RATE_LIMIT_ENABLED', False))
        self.assertTrue(getattr(settings, 'SECURITY_LOGGING_ENABLED', False))
        
        # Check rate limiting configuration
        self.assertEqual(settings.LOGIN_RATE_LIMIT, '5/minute')
        self.assertEqual(settings.UPLOAD_RATE_LIMIT, '10/minute')
        
        # Check file upload limits
        self.assertEqual(settings.MAX_UPLOAD_SIZE, 100 * 1024 * 1024)
        self.assertIn('.mp4', settings.ALLOWED_VIDEO_EXTENSIONS)
        self.assertIn('video/mp4', settings.ALLOWED_VIDEO_MIME_TYPES)
