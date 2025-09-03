import pytest
from django.test import Client
from django.contrib.auth.models import User
from core.models import VideoAsset

class TestCoreFunctionality:
    @pytest.fixture
    def client(self):
        return Client()
    
    @pytest.fixture
    def user(self, db):
        return User.objects.create_user(username='testuser', password='testpass')
    
    @pytest.fixture
    def staff_user(self, db):
        return User.objects.create_user(
            username='staffuser', 
            password='testpass',
            is_staff=True
        )
    
    def test_health_endpoint_works(self, client):
        """Test health endpoint"""
        response = client.get('/core/health/')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
    
    def test_upload_video_requires_auth(self, client):
        """Test video upload requires authentication"""
        response = client.post('/core/api/upload-video/')
        assert response.status_code == 302  # Redirect to login
    
    def test_list_videos_requires_auth(self, client):
        """Test video listing requires authentication"""
        response = client.get('/core/api/videos/')
        assert response.status_code == 302  # Redirect to login
    
    def test_delete_video_requires_auth(self, client):
        """Test video deletion requires authentication"""
        response = client.delete('/core/api/videos/123e4567-e89b-12d3-a456-426614174000/delete/')
        assert response.status_code == 302  # Redirect to login

