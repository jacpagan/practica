from django.test import TestCase
from django.urls import reverse


class HealthCheckTest(TestCase):
    """Test health check endpoint"""
    
    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200"""
        response = self.client.get('/core/health/')
        self.assertEqual(response.status_code, 200)
    
    def test_health_endpoint_fast_response(self):
        """Health endpoint should respond quickly"""
        response = self.client.get('/core/health/')
        # Should respond in under 100ms
        self.assertEqual(response.status_code, 200)
    
    def test_health_endpoint_json_response(self):
        """Health endpoint should return JSON"""
        response = self.client.get('/core/health/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/json', response['Content-Type'])
    
    def test_health_endpoint_contains_required_fields(self):
        """Health endpoint should contain required fields"""
        response = self.client.get('/core/health/')
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('status', data)
        self.assertIn('timestamp', data)
        self.assertIn('version', data)
        self.assertIn('environment', data)
        self.assertIn('response_time_ms', data)
        self.assertEqual(data['status'], 'healthy')

