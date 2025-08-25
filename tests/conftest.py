import pytest
import tempfile
import os
from django.conf import settings
from django.test import RequestFactory
from django.contrib.auth.models import User

# Configure pytest for Django
pytest_plugins = ['pytest_django']

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.test_settings')

# Fixtures
@pytest.fixture
def request_factory():
    return RequestFactory()

@pytest.fixture
def user():
    return User.objects.create_user(
        username='testuser',
        password='testpass123',
        email='test@example.com'
    )

@pytest.fixture
def admin_user():
    return User.objects.create_user(
        username='admin',
        password='adminpass123',
        email='admin@example.com',
        is_staff=True,
        is_superuser=True
    )

@pytest.fixture
def test_video_file():
    """Create a temporary test video file"""
    temp_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
    temp_file.write(b'\x00\x00\x00\x20ftypmp4fake video content')
    temp_file.close()
    
    yield temp_file.name
    
    # Cleanup
    try:
        os.unlink(temp_file.name)
    except OSError:
        pass

# Cleanup function for test files
@pytest.fixture(autouse=True)
def cleanup_test_files():
    yield
    # Cleanup any remaining test files
    if hasattr(settings, 'MEDIA_ROOT'):
        for root, dirs, files in os.walk(settings.MEDIA_ROOT):
            for file in files:
                if file.startswith('tmp') or file.endswith('.tmp'):
                    try:
                        os.unlink(os.path.join(root, file))
                    except OSError:
                        pass
