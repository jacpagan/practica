"""
Mobile Compatibility Tests

Tests for ensuring the application works properly on older mobile devices
including iPhone SE and other small screen devices.
"""

import pytest
from django.test import TestCase, RequestFactory
from django.http import HttpResponse
from unittest.mock import patch, MagicMock

from core.middleware import MobileOptimizationMiddleware


class MobileCompatibilityTestCase(TestCase):
    """Test case for mobile compatibility features."""
    
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = MobileOptimizationMiddleware(lambda r: HttpResponse())
    
    def test_iphone_se_detection(self):
        """Test iPhone SE device detection."""
        # iPhone SE 2nd generation user agent
        user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        self.middleware.process_request(request)
        
        self.assertTrue(request.is_mobile)
        self.assertEqual(request.device_type, 'iphone')
        self.assertTrue(request.is_iphone_se)
        self.assertTrue(request.is_small_screen)
        
        # Check mobile settings
        self.assertEqual(request.mobile_settings['touch_target_size'], 'medium')
        self.assertEqual(request.mobile_settings['performance_mode'], 'balanced')
        self.assertFalse(request.mobile_settings['animation_reduction'])
    
    def test_old_ios_device_detection(self):
        """Test older iOS device detection (before iOS 14)."""
        # iPhone 6s with iOS 13 user agent
        user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        self.middleware.process_request(request)
        
        self.assertTrue(request.is_mobile)
        self.assertEqual(request.device_type, 'iphone')
        self.assertTrue(request.is_old_ios)
        self.assertTrue(request.is_small_screen)
        
        # Check mobile settings for older devices
        self.assertEqual(request.mobile_settings['touch_target_size'], 'large')
        self.assertEqual(request.mobile_settings['performance_mode'], 'conservative')
        self.assertTrue(request.mobile_settings['animation_reduction'])
        self.assertTrue(request.mobile_settings['use_fallback_methods'])
    
    def test_modern_iphone_detection(self):
        """Test modern iPhone device detection."""
        # iPhone 13 with iOS 15 user agent
        user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        self.middleware.process_request(request)
        
        self.assertTrue(request.is_mobile)
        self.assertEqual(request.device_type, 'iphone')
        self.assertFalse(request.is_old_ios)
        self.assertFalse(request.is_iphone_se)
        self.assertFalse(request.is_small_screen)
        
        # Check mobile settings for modern devices
        self.assertEqual(request.mobile_settings['touch_target_size'], 'standard')
        self.assertEqual(request.mobile_settings['performance_mode'], 'optimized')
        self.assertFalse(request.mobile_settings['animation_reduction'])
    
    def test_android_device_detection(self):
        """Test Android device detection."""
        # Android 9 device user agent
        user_agent = "Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        self.middleware.process_request(request)
        
        self.assertTrue(request.is_mobile)
        self.assertEqual(request.device_type, 'android')
        self.assertTrue(request.is_old_android)
        self.assertTrue(request.is_small_screen)
        
        # Check mobile settings for older Android
        self.assertEqual(request.mobile_settings['touch_target_size'], 'large')
        self.assertEqual(request.mobile_settings['performance_mode'], 'conservative')
        self.assertTrue(request.mobile_settings['animation_reduction'])
    
    def test_desktop_device_detection(self):
        """Test desktop device detection."""
        # Desktop Chrome user agent
        user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        self.middleware.process_request(request)
        
        self.assertFalse(request.is_mobile)
        self.assertEqual(request.device_type, 'desktop')
        self.assertFalse(hasattr(request, 'is_iphone_se'))
        self.assertFalse(hasattr(request, 'is_small_screen'))
        
        # Check desktop settings
        self.assertEqual(request.mobile_settings['touch_target_size'], 'standard')
        self.assertEqual(request.mobile_settings['performance_mode'], 'optimized')
        self.assertFalse(request.mobile_settings['animation_reduction'])
    
    def test_mobile_response_headers(self):
        """Test mobile-specific response headers."""
        # iPhone SE user agent
        user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        # Process request
        self.middleware.process_request(request)
        
        # Create response
        response = HttpResponse()
        
        # Process response
        processed_response = self.middleware.process_response(request, response)
        
        # Check mobile headers
        self.assertEqual(processed_response['X-Device-Type'], 'iphone')
        self.assertEqual(processed_response['X-Mobile-Optimized'], 'true')
        self.assertEqual(processed_response['X-iPhone-SE'], 'true')
        self.assertEqual(processed_response['X-Small-Screen'], 'true')
        self.assertEqual(processed_response['X-Performance-Mode'], 'balanced')
        self.assertEqual(processed_response['X-Touch-Target-Size'], 'medium')
        self.assertEqual(processed_response['X-Animation-Reduction'], 'false')
    
    def test_old_device_response_headers(self):
        """Test response headers for older devices."""
        # Old iOS device user agent
        user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1"
        
        request = self.factory.get('/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        # Process request
        self.middleware.process_request(request)
        
        # Create response
        response = HttpResponse()
        
        # Process response
        processed_response = self.middleware.process_response(request, response)
        
        # Check legacy headers
        self.assertEqual(processed_response['X-Legacy-iOS'], 'true')
        self.assertEqual(processed_response['X-Fallback-Methods'], 'enabled')
        self.assertEqual(processed_response['X-Performance-Mode'], 'conservative')
        self.assertEqual(processed_response['X-Touch-Target-Size'], 'large')
        self.assertEqual(processed_response['X-Animation-Reduction'], 'true')
    
    def test_mobile_404_error_handling(self):
        """Test mobile-friendly 404 error handling."""
        # iPhone SE user agent
        user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1"
        
        request = self.factory.get('/nonexistent/')
        request.META['HTTP_USER_AGENT'] = user_agent
        
        # Process request
        self.middleware.process_request(request)
        
        # Simulate 404 exception
        from django.http import Http404
        exception = Http404("Page not found")
        
        # Process exception
        response = self.middleware.process_exception(request, exception)
        
        # Check mobile-friendly 404 response
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 404)
        
        import json
        data = json.loads(response.content)
        self.assertTrue(data['mobile_friendly'])
        self.assertEqual(data['device_type'], 'iphone')
        self.assertTrue(data['is_iphone_se'])
        self.assertTrue(data['is_small_screen'])
        self.assertFalse(data['fallback_available'])
    
    def test_ios_version_extraction(self):
        """Test iOS version extraction from user agent."""
        # Test various iOS versions
        test_cases = [
            ("Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X)", 13),
            ("Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)", 14),
            ("Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)", 15),
            ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X)", 16),
        ]
        
        for user_agent, expected_version in test_cases:
            with self.subTest(user_agent=user_agent):
                version = self.middleware.extract_ios_version(user_agent)
                self.assertEqual(version, expected_version)
    
    def test_android_version_extraction(self):
        """Test Android version extraction from user agent."""
        # Test various Android versions
        test_cases = [
            ("Mozilla/5.0 (Linux; Android 9; SM-G960F)", 9),
            ("Mozilla/5.0 (Linux; Android 10; SM-G970F)", 10),
            ("Mozilla/5.0 (Linux; Android 11; SM-G991B)", 11),
            ("Mozilla/5.0 (Linux; Android 12; SM-G998B)", 12),
        ]
        
        for user_agent, expected_version in test_cases:
            with self.subTest(user_agent=user_agent):
                version = self.middleware.extract_android_version(user_agent)
                self.assertEqual(version, expected_version)
    
    def test_small_screen_device_detection(self):
        """Test small screen device detection."""
        # Test various small screen devices
        small_screen_devices = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1",  # iPhone SE
            "Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1",  # iPhone 6s
            "Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",  # Android
        ]
        
        for user_agent in small_screen_devices:
            with self.subTest(user_agent=user_agent):
                request = self.factory.get('/')
                request.META['HTTP_USER_AGENT'] = user_agent
                
                self.middleware.process_request(request)
                
                self.assertTrue(request.is_small_screen)
    
    def test_mobile_settings_consistency(self):
        """Test that mobile settings are consistent across device types."""
        # Test that all mobile devices have required settings
        test_devices = [
            ("iPhone SE", "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1"),
            ("Old iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1"),
            ("Old Android", "Mozilla/5.0 (Linux; Android 9; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"),
            ("Modern Device", "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"),
        ]
        
        required_settings = [
            'video_quality', 'max_recording_time', 'use_fallback_methods',
            'enable_legacy_support', 'compression_level', 'cache_strategy',
            'pwa_features', 'touch_target_size', 'animation_reduction',
            'performance_mode'
        ]
        
        for device_name, user_agent in test_devices:
            with self.subTest(device=device_name):
                request = self.factory.get('/')
                request.META['HTTP_USER_AGENT'] = user_agent
                
                self.middleware.process_request(request)
                
                # Check that all required settings are present
                for setting in required_settings:
                    self.assertIn(setting, request.mobile_settings, 
                                f"Missing setting '{setting}' for {device_name}")
                
                # Check that settings have valid values
                self.assertIn(request.mobile_settings['touch_target_size'], 
                            ['standard', 'medium', 'large'])
                self.assertIn(request.mobile_settings['performance_mode'], 
                            ['conservative', 'balanced', 'optimized'])
                self.assertIsInstance(request.mobile_settings['animation_reduction'], bool)


class MobileOptimizationIntegrationTestCase(TestCase):
    """Integration tests for mobile optimization features."""
    
    def test_mobile_middleware_integration(self):
        """Test that mobile middleware integrates properly with Django."""
        from django.test import Client
        
        client = Client()
        
        # Test with iPhone SE user agent
        headers = {
            'HTTP_USER_AGENT': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
        }
        
        # Make a request to trigger middleware
        response = client.get('/', **headers)
        
        # Check that mobile headers are present
        self.assertIn('X-Mobile-Optimized', response)
        self.assertEqual(response['X-Mobile-Optimized'], 'true')
        
        # Check device-specific headers
        self.assertIn('X-Device-Type', response)
        self.assertEqual(response['X-Device-Type'], 'iphone')
        
        # Check iPhone SE specific headers
        self.assertIn('X-iPhone-SE', response)
        self.assertEqual(response['X-iPhone-SE'], 'true')


if __name__ == '__main__':
    pytest.main([__file__])
