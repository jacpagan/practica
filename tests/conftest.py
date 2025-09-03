"""
Pytest configuration for Practika DDD testing
"""
import pytest
import os
import sys
from unittest.mock import Mock, patch
from django.test import TestCase
from django.conf import settings

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure Django settings for testing
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.test_settings')

# Import Django settings
import django
django.setup()

# Domain-specific fixtures
@pytest.fixture
def video_asset_factory():
    """Factory for creating VideoAsset domain objects"""
    from core.models import VideoAsset
    from django.contrib.auth.models import User
    
    def _create_video_asset(**kwargs):
        defaults = {
            'orig_filename': 'test-video.mp4',
            'storage_path': 'videos/test-video.mp4',
            'size_bytes': 1024000,
            'duration': 30.0,
            'uploaded_by': User.objects.create_user(username='testuser', password='testpass'),
            'upload_status': 'completed'
        }
        defaults.update(kwargs)
        return VideoAsset.objects.create(**defaults)
    
    return _create_video_asset

@pytest.fixture
def video_clip_factory():
    """Factory for creating VideoClip domain objects"""
    from core.models import VideoClip
    
    def _create_video_clip(video_asset, **kwargs):
        defaults = {
            'original_video': video_asset,
            'start_time': 10.0,
            'end_time': 20.0,
            'duration': 10.0,
            'storage_path': f'clips/{video_asset.id}_clip.mp4',
            'processing_status': 'completed'
        }
        defaults.update(kwargs)
        return VideoClip.objects.create(**defaults)
    
    return _create_video_clip

@pytest.fixture
def comment_factory():
    """Factory for creating Comment domain objects"""
    from comments.models import Comment
    from django.contrib.auth.models import User
    
    def _create_comment(video_asset, **kwargs):
        defaults = {
            'video': video_asset,
            'content': 'Test comment',
            'timestamp': 15.0,
            'author': User.objects.create_user(username='commenter', password='testpass')
        }
        defaults.update(kwargs)
        return Comment.objects.create(**defaults)
    
    return _create_comment

@pytest.fixture
def user_factory():
    """Factory for creating User domain objects"""
    from django.contrib.auth.models import User
    
    def _create_user(**kwargs):
        defaults = {
            'username': f'testuser_{pytest.unique_id}',
            'password': 'testpass123',
            'email': f'testuser_{pytest.unique_id}@example.com'
        }
        defaults.update(kwargs)
        user = User.objects.create_user(**defaults)
        return user
    
    return _create_user

# Application service fixtures
@pytest.fixture
def video_processor_service():
    """Video processing service fixture"""
    from core.services.video_processor import VideoProcessorService
    return VideoProcessorService()

@pytest.fixture
def video_clip_service():
    """Video clip service fixture"""
    from core.services.video_clip_service import VideoClipService
    return VideoClipService()

@pytest.fixture
def storage_service():
    """Storage service fixture"""
    from core.services.storage import VideoStorageService
    return VideoStorageService()

# Infrastructure fixtures
@pytest.fixture
def mock_s3_storage():
    """Mock S3 storage for testing"""
    with patch('core.services.storage.default_storage') as mock_storage:
        mock_storage.open.return_value.__enter__.return_value.read.return_value = b'test video data'
        mock_storage.save.return_value = 'videos/test-video.mp4'
        mock_storage.size.return_value = 1024000
        mock_storage.exists.return_value = True
        yield mock_storage

@pytest.fixture
def mock_ffmpeg():
    """Mock FFmpeg for testing"""
    with patch('core.services.video_processor.ffmpeg') as mock_ffmpeg:
        mock_ffmpeg.probe.return_value = {
            'streams': [{
                'codec_type': 'video',
                'width': 1920,
                'height': 1080,
                'duration': '30.0',
                'r_frame_rate': '30/1',
                'codec_name': 'h264'
            }]
        }
        mock_ffmpeg.input.return_value.filter.return_value.output.return_value = Mock()
        mock_ffmpeg.run.return_value = None
        yield mock_ffmpeg

# Test database configuration
@pytest.fixture(scope='session')
def django_db_setup(django_db_setup, django_db_blocker):
    """Configure test database"""
    with django_db_blocker.unblock():
        from django.core.management import call_command
        call_command('migrate', verbosity=0)

@pytest.fixture
def db_access_without_rollback_and_truncate(django_db_setup, django_db_blocker):
    """Database access without rollback for integration tests"""
    django_db_blocker.unblock()
    yield
    django_db_blocker.restore()

# Domain event fixtures
@pytest.fixture
def domain_event_bus():
    """Domain event bus for testing"""
    from core.domain.events import DomainEventBus
    return DomainEventBus()

@pytest.fixture
def mock_event_publisher():
    """Mock event publisher for testing"""
    with patch('core.domain.events.DomainEventBus.publish') as mock_publish:
        yield mock_publish

# API testing fixtures
@pytest.fixture
def api_client():
    """Django REST framework test client"""
    from rest_framework.test import APIClient
    return APIClient()

@pytest.fixture
def authenticated_client(api_client, user_factory):
    """Authenticated API client"""
    user = user_factory()
    api_client.force_authenticate(user=user)
    return api_client

# Performance testing fixtures
@pytest.fixture
def performance_timer():
    """Timer for performance testing"""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            self.start_time = time.time()
        
        def stop(self):
            self.end_time = time.time()
        
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()

# Markers for different test types
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "unit: Unit tests for domain objects"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests for services"
    )
    config.addinivalue_line(
        "markers", "acceptance: Acceptance tests for user stories"
    )
    config.addinivalue_line(
        "markers", "domain: Domain logic tests"
    )
    config.addinivalue_line(
        "markers", "application: Application service tests"
    )
    config.addinivalue_line(
        "markers", "infrastructure: Infrastructure tests"
    )
    config.addinivalue_line(
        "markers", "performance: Performance tests"
    )
    config.addinivalue_line(
        "markers", "slow: Slow running tests"
    )

# Unique ID generator for test data
@pytest.fixture(scope='session')
def unique_id_generator():
    """Generate unique IDs for test data"""
    import uuid
    
    def _generate_id():
        return str(uuid.uuid4())[:8]
    
    return _generate_id

# Set unique ID for pytest
pytest.unique_id = None

@pytest.fixture(autouse=True)
def set_unique_id(unique_id_generator):
    """Set unique ID for each test"""
    pytest.unique_id = unique_id_generator()
