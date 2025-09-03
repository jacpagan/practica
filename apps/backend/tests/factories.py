"""
Test data factories for Practika tests
"""
import tempfile
import os
import uuid
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from core.models import VideoAsset
from exercises.models import Exercise
from comments.models import VideoComment
from accounts.models import Profile, Role


class TestDataFactory:
    """Factory for creating test data with valid MIME types and content"""
    
    @staticmethod
    def create_test_video_file(suffix='.mp4', size=1024):
        """Create a test video file with valid content"""
        # Create temporary file with proper video content
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        
        if suffix == '.mp4':
            # Create a more complete MP4 file structure
            # MP4 file signature (ftyp box)
            temp_file.write(b'\x00\x00\x00\x20')  # Box size
            temp_file.write(b'ftyp')               # Box type
            temp_file.write(b'mp4')                # Major brand
            temp_file.write(b'\x00\x00\x00\x00')  # Minor version
            temp_file.write(b'mp4')                # Compatible brand
            temp_file.write(b'isom')               # Compatible brand
            temp_file.write(b'avc1')               # Compatible brand
            
            # Add some dummy data to make it look more like a real MP4
            remaining_size = size - temp_file.tell()
            if remaining_size > 0:
                temp_file.write(b'\x00' * remaining_size)
        elif suffix == '.webm':
            # WebM file signature
            temp_file.write(b'\x1a\x45\xdf\xa3')
        elif suffix == '.mov':
            # MOV file signature
            temp_file.write(b'\x00\x00\x00\x14ftypqt')
        elif suffix == '.avi':
            # AVI file signature
            temp_file.write(b'RIFF')
        
        # Add some content to make it a valid file
        temp_file.write(b'\x00' * (size - temp_file.tell()))
        temp_file.close()
        
        return temp_file.name
    
    @staticmethod
    def create_video_asset(**kwargs):
        """Create a VideoAsset with valid data"""
        defaults = {
            'id': uuid.uuid4(),
            'orig_filename': 'test_video.mp4',
            'storage_path': TestDataFactory.create_test_video_file('.mp4'),
            'mime_type': 'video/mp4',
            'size_bytes': 1024,
            'checksum_sha256': 'a' * 64,  # Valid SHA256 length
            'duration_sec': 10,
            'width': 1920,
            'height': 1080,
            'processing_status': 'completed',
            'is_valid': True,
            'validation_errors': [],
            'renditions': {},
        }
        defaults.update(kwargs)
        
        return VideoAsset.objects.create(**defaults)
    
    @staticmethod
    def create_user(**kwargs):
        """Create a User with valid data"""
        defaults = {
            'username': f'testuser_{uuid.uuid4().hex[:8]}',
            'email': f'test_{uuid.uuid4().hex[:8]}@example.com',
            'is_staff': False,
            'is_active': True,
        }
        defaults.update(kwargs)
        
        user = User.objects.create_user(**defaults)
        if 'password' in kwargs:
            user.set_password(kwargs['password'])
            user.save()
        else:
            user.set_password('testpass123')
            user.save()
        
        # Create Profile for the user
        try:
            role_name = kwargs.get('role', 'student')
            role, _ = Role.objects.get_or_create(name=role_name)
            Profile.objects.get_or_create(user=user, defaults={'role': role})
        except Exception:
            # If Role/Profile models don't exist yet, skip profile creation
            pass
        
        return user
    
    @staticmethod
    def create_admin_user(**kwargs):
        """Create an admin User with valid data"""
        defaults = {
            'username': f'admin_{uuid.uuid4().hex[:8]}',
            'email': f'admin_{uuid.uuid4().hex[:8]}@example.com',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
        }
        defaults.update(kwargs)
        
        user = User.objects.create_user(**defaults)
        if 'password' in kwargs:
            user.set_password(kwargs['password'])
            user.save()
        else:
            user.set_password('adminpass123')
            user.save()
        
        # Create Profile for the admin user
        try:
            role_name = kwargs.get('role', 'instructor')
            role, _ = Role.objects.get_or_create(name=role_name)
            Profile.objects.get_or_create(user=user, defaults={'role': role})
        except Exception:
            # If Role/Profile models don't exist yet, skip profile creation
            pass
        
        return user
    
    @staticmethod
    def create_exercise(**kwargs):
        """Create an Exercise with valid data"""
        if 'video_asset' not in kwargs:
            kwargs['video_asset'] = TestDataFactory.create_video_asset()
        if 'created_by' not in kwargs:
            kwargs['created_by'] = TestDataFactory.create_admin_user()
        
        defaults = {
            'id': uuid.uuid4(),
            'name': f'Test Exercise {uuid.uuid4().hex[:8]}',
            'description': 'Test exercise description',
        }
        defaults.update(kwargs)
        
        return Exercise.objects.create(**defaults)
    
    @staticmethod
    def create_video_comment(**kwargs):
        """Create a VideoComment with valid data"""
        if 'exercise' not in kwargs:
            kwargs['exercise'] = TestDataFactory.create_exercise()
        if 'author' not in kwargs:
            kwargs['author'] = TestDataFactory.create_user()
        if 'video_asset' not in kwargs:
            kwargs['video_asset'] = TestDataFactory.create_video_asset()
        
        defaults = {
            'id': uuid.uuid4(),
            'text': 'Test comment text',
        }
        defaults.update(kwargs)
        
        return VideoComment.objects.create(**defaults)
    
    @staticmethod
    def create_simple_uploaded_file(filename='test_video.mp4', content_type='video/mp4', size=1024):
        """Create a SimpleUploadedFile for testing file uploads"""
        # Create valid video content
        if filename.endswith('.mp4'):
            content = b'\x00\x00\x00\x20ftypmp4' + b'\x00' * (size - 20)
        elif filename.endswith('.webm'):
            content = b'\x1a\x45\xdf\xa3' + b'\x00' * (size - 4)
        elif filename.endswith('.mov'):
            content = b'\x00\x00\x00\x14ftypqt' + b'\x00' * (size - 20)
        elif filename.endswith('.avi'):
            content = b'RIFF' + b'\x00' * (size - 4)
        else:
            content = b'\x00' * size
        
        return SimpleUploadedFile(filename, content, content_type=content_type)
    
    @staticmethod
    def cleanup_test_files():
        """Clean up any test files created during testing"""
        # This method can be called in test teardown to clean up files
        pass


# Convenience functions for common test scenarios
def create_test_user(**kwargs):
    """Create a test user"""
    return TestDataFactory.create_user(**kwargs)


def create_test_admin(**kwargs):
    """Create a test admin user"""
    return TestDataFactory.create_admin_user(**kwargs)


def create_test_video_asset(**kwargs):
    """Create a test video asset"""
    return TestDataFactory.create_video_asset(**kwargs)


def create_test_exercise(**kwargs):
    """Create a test exercise"""
    return TestDataFactory.create_exercise(**kwargs)


def create_test_video_comment(**kwargs):
    """Create a test video comment"""
    return TestDataFactory.create_video_comment(**kwargs)


def create_test_video_file(**kwargs):
    """Create a test video file"""
    return TestDataFactory.create_simple_uploaded_file(**kwargs)
