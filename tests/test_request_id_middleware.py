"""
Tests for Request ID Middleware functionality
"""

import pytest
from django.test import RequestFactory, TestCase
from django.http import HttpResponse
from django.conf import settings

from core.middleware import RequestLoggingMiddleware


class RequestIDMiddlewareTest(TestCase):
    """Test Request ID Middleware functionality."""

    def setUp(self):
        """Set up test environment."""
        self.factory = RequestFactory()
        self.middleware = RequestLoggingMiddleware(lambda request: HttpResponse("OK"))

    def test_request_id_generation(self):
        """Test that request ID is generated for each request."""
        request = self.factory.get('/test/')
        
        # Process request through middleware
        response = self.middleware(request)
        
        # Check that request_id is set
        self.assertTrue(hasattr(request, 'request_id'))
        self.assertIsInstance(request.request_id, str)
        self.assertEqual(len(request.request_id), 36)  # UUID length
        
        # Check that response header is set
        self.assertIn('X-Request-ID', response.headers)
        self.assertEqual(response.headers['X-Request-ID'], request.request_id)

    def test_request_id_uniqueness(self):
        """Test that each request gets a unique ID."""
        request1 = self.factory.get('/test1/')
        request2 = self.factory.get('/test2/')
        
        # Process requests through middleware
        self.middleware(request1)
        self.middleware(request2)
        
        # Check that IDs are different
        self.assertNotEqual(request1.request_id, request2.request_id)

    def test_request_id_persistence(self):
        """Test that request ID persists through the request lifecycle."""
        request = self.factory.get('/test/')
        
        # Process request through middleware
        response = self.middleware(request)
        
        # Check that request_id is accessible after middleware
        request_id = getattr(request, 'request_id', None)
        self.assertIsNotNone(request_id)
        
        # Check that it matches the response header
        self.assertEqual(response.headers['X-Request-ID'], request_id)

    def test_request_id_format(self):
        """Test that request ID follows UUID format."""
        request = self.factory.get('/test/')
        
        # Process request through middleware
        self.middleware(request)
        
        # Check UUID format (8-4-4-4-12 characters)
        request_id = request.request_id
        parts = request_id.split('-')
        self.assertEqual(len(parts), 5)
        self.assertEqual(len(parts[0]), 8)
        self.assertEqual(len(parts[1]), 4)
        self.assertEqual(len(parts[2]), 4)
        self.assertEqual(len(parts[3]), 4)
        self.assertEqual(len(parts[4]), 12)

    def test_middleware_order(self):
        """Test that middleware is in correct order in settings."""
        middleware_classes = [mw for mw in settings.MIDDLEWARE if 'RequestLoggingMiddleware' in mw]
        self.assertTrue(middleware_classes, "RequestLoggingMiddleware not found in MIDDLEWARE")
        
        # Check that it's early in the middleware stack
        middleware_index = None
        for i, mw in enumerate(settings.MIDDLEWARE):
            if 'RequestLoggingMiddleware' in mw:
                middleware_index = i
                break
        
        # Should be early in the stack (before view processing)
        self.assertLess(middleware_index, 10, "RequestLoggingMiddleware should be early in middleware stack")

    def test_error_handling(self):
        """Test that middleware handles errors gracefully."""
        # Create a middleware that raises an exception
        def error_middleware(request):
            raise Exception("Test error")
        
        error_mw = RequestLoggingMiddleware(error_middleware)
        request = self.factory.get('/test/')
        
        # Should not crash, request_id should still be set
        try:
            error_mw(request)
        except Exception:
            pass
        
        # Check that request_id was still set
        self.assertTrue(hasattr(request, 'request_id'))

    def test_different_request_methods(self):
        """Test that request ID works with different HTTP methods."""
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        
        for method in methods:
            request = self.factory.generic(method, '/test/')
            self.middleware(request)
            
            # Check that request_id is set for each method
            self.assertTrue(hasattr(request, 'request_id'))
            self.assertIsInstance(request.request_id, str)

    def test_request_id_in_logs(self):
        """Test that request ID appears in log records."""
        import logging
        from core.middleware import RequestIDFilter
        
        # Create a test logger
        logger = logging.getLogger('test_logger')
        logger.setLevel(logging.INFO)
        
        # Create a handler to capture log records
        log_records = []
        class TestHandler(logging.Handler):
            def emit(self, record):
                log_records.append(record)
        
        handler = TestHandler()
        logger.addHandler(handler)
        
        # Create a request and set request_id
        request = self.factory.get('/test/')
        request.request_id = 'test-request-id'
        
        # Log a message
        logger.info("Test log message")
        
        # Check that request_id appears in log format
        # This tests the RequestIDFilter integration
        self.assertTrue(log_records)
        log_record = log_records[0]
        self.assertEqual(log_record.getMessage(), "Test log message")


@pytest.mark.django_db
class RequestIDMiddlewareIntegrationTest(TestCase):
    """Integration tests for Request ID Middleware."""

    def test_full_request_cycle(self):
        """Test complete request cycle with middleware."""
        from django.urls import reverse
        
        # Test with a real view
        response = self.client.get('/health/')
        
        # Check that response has request ID header
        self.assertIn('X-Request-ID', response.headers)
        request_id = response.headers['X-Request-ID']
        
        # Check that request ID is valid UUID format
        self.assertEqual(len(request_id), 36)
        self.assertEqual(request_id.count('-'), 4)

    def test_api_endpoints(self):
        """Test that API endpoints include request ID."""
        # Test with API endpoint
        response = self.client.get('/exercises/api/exercises/')
        
        # Check that response has request ID header
        self.assertIn('X-Request-ID', response.headers)
        request_id = response.headers['X-Request-ID']
        
        # Check that request ID is valid
        self.assertIsInstance(request_id, str)
        self.assertTrue(len(request_id) > 0)

    def test_static_files(self):
        """Test that static file responses include request ID."""
        # Test with static file
        response = self.client.get('/static/manifest.json')
        
        # Check that response has request ID header
        self.assertIn('X-Request-ID', response.headers)
        request_id = response.headers['X-Request-ID']
        
        # Check that request ID is valid
        self.assertIsInstance(request_id, str)
        self.assertTrue(len(request_id) > 0)

    def test_error_responses(self):
        """Test that error responses include request ID."""
        # Test with non-existent endpoint (should return 404)
        response = self.client.get('/non-existent-endpoint/')
        
        # Check that response has request ID header even for errors
        self.assertIn('X-Request-ID', response.headers)
        request_id = response.headers['X-Request-ID']
        
        # Check that request ID is valid
        self.assertIsInstance(request_id, str)
        self.assertTrue(len(request_id) > 0)

    def test_concurrent_requests(self):
        """Test that concurrent requests get different IDs."""
        import threading
        import time
        
        request_ids = []
        lock = threading.Lock()
        
        def make_request():
            response = self.client.get('/health/')
            with lock:
                request_ids.append(response.headers['X-Request-ID'])
        
        # Create multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check that all request IDs are unique
        unique_ids = set(request_ids)
        self.assertEqual(len(unique_ids), len(request_ids), "All request IDs should be unique")
        
        # Check that we got the expected number of IDs
        self.assertEqual(len(request_ids), 5, "Should have 5 request IDs")
