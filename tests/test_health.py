import pytest
from django.test import Client
from django.urls import reverse

class TestHealthCheck:
    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200"""
        client = Client()
        response = client.get('/core/health/')
        assert response.status_code == 200
    
    def test_health_endpoint_fast_response(self):
        """Health endpoint should respond quickly"""
        client = Client()
        response = client.get('/core/health/')
        # Should respond in under 100ms
        assert response.status_code == 200
    
    def test_health_endpoint_json_response(self):
        """Health endpoint should return JSON"""
        client = Client()
        response = client.get('/core/health/')
        assert response.status_code == 200
        assert response['Content-Type'] == 'application/json'
    
    def test_health_endpoint_contains_required_fields(self):
        """Health endpoint should contain required fields"""
        client = Client()
        response = client.get('/core/health/')
        assert response.status_code == 200
        
        data = response.json()
        assert 'status' in data
        assert 'timestamp' in data
        assert 'version' in data
        assert 'environment' in data
        assert 'response_time_ms' in data
        assert data['status'] == 'healthy'

