import pytest
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from rest_framework.test import APITestCase
from rest_framework import status
from core.models import VideoAsset
from exercises.models import Exercise
from core.services.storage import VideoStorageService
from model_bakery import baker


class MediaValidationTest(APITestCase):
    def setUp(self):
        self.user = baker.make(User, is_staff=True)
        self.video_asset = baker.make(VideoAsset)
        self.exercise = baker.make(Exercise, video_asset=self.video_asset, created_by=self.user)

    def test_accepts_supported_video_mime_types(self):
        """Test that supported MIME types are accepted"""
        storage_service = VideoStorageService()
        
        # Test MP4
        mp4_file = SimpleUploadedFile(
            "test.mp4",
            b"fake mp4 content",
            content_type="video/mp4"
        )
        
        try:
            video_asset = storage_service.store_uploaded_video(mp4_file)
            self.assertEqual(video_asset.mime_type, "video/mp4")
        except Exception as e:
            self.fail(f"MP4 should be accepted: {e}")

    def test_rejects_unsupported_mime_types(self):
        """Test that unsupported MIME types are rejected"""
        storage_service = VideoStorageService()
        
        # Test unsupported type
        unsupported_file = SimpleUploadedFile(
            "test.avi",
            b"fake avi content",
            content_type="video/x-msvideo"
        )
        
        with self.assertRaises(ValueError):
            storage_service.store_uploaded_video(unsupported_file)

    def test_rejects_text_files(self):
        """Test that text files are rejected"""
        storage_service = VideoStorageService()
        
        text_file = SimpleUploadedFile(
            "test.txt",
            b"this is text content",
            content_type="text/plain"
        )
        
        with self.assertRaises(ValueError):
            storage_service.store_uploaded_video(text_file)

    def test_exercise_creation_requires_video(self):
        """Test that exercise creation fails without video"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'name': 'Exercise Without Video',
            'description': 'This should fail'
        }
        
        response = self.client.post('/api/v1/exercises/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comment_creation_requires_video(self):
        """Test that comment creation fails without video"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'exercise_id': str(self.exercise.id),
            'text': 'Comment without video should fail'
        }
        
        response = self.client.post('/api/v1/video-comments/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_video_comment_requires_exercise_id(self):
        """Test that video comment creation fails without exercise_id"""
        self.client.force_authenticate(user=self.user)
        
        video_file = SimpleUploadedFile(
            "comment.mp4",
            b"fake comment video content",
            content_type="video/mp4"
        )
        
        data = {
            'video': video_file,
            'text': 'Comment without exercise_id should fail'
        }
        
        response = self.client.post('/api/v1/video-comments/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_video_asset_checksum_calculation(self):
        """Test that video asset checksum is calculated"""
        storage_service = VideoStorageService()
        
        video_file = SimpleUploadedFile(
            "test.mp4",
            b"fake video content for checksum test",
            content_type="video/mp4"
        )
        
        video_asset = storage_service.store_uploaded_video(video_file)
        self.assertIsNotNone(video_asset.checksum_sha256)
        self.assertEqual(len(video_asset.checksum_sha256), 64)

    def test_video_asset_size_recording(self):
        """Test that video asset size is recorded"""
        storage_service = VideoStorageService()
        
        video_content = b"fake video content for size test"
        video_file = SimpleUploadedFile(
            "test.mp4",
            video_content,
            content_type="video/mp4"
        )
        
        video_asset = storage_service.store_uploaded_video(video_file)
        self.assertEqual(video_asset.size_bytes, len(video_content))

    def test_video_asset_mime_type_detection(self):
        """Test that video asset MIME type is correctly detected"""
        storage_service = VideoStorageService()
        
        video_file = SimpleUploadedFile(
            "test.webm",
            b"fake webm content",
            content_type="video/webm"
        )
        
        video_asset = storage_service.store_uploaded_video(video_file)
        self.assertEqual(video_asset.mime_type, "video/webm")

    def test_video_asset_original_filename_preservation(self):
        """Test that video asset preserves original filename"""
        storage_service = VideoStorageService()
        
        original_filename = "my_exercise_video.mp4"
        video_file = SimpleUploadedFile(
            original_filename,
            b"fake video content",
            content_type="video/mp4"
        )
        
        video_asset = storage_service.store_uploaded_video(video_file)
        self.assertEqual(video_asset.orig_filename, original_filename)

    def test_video_asset_storage_path_generation(self):
        """Test that video asset generates proper storage path"""
        storage_service = VideoStorageService()
        
        video_file = SimpleUploadedFile(
            "test.mp4",
            b"fake video content",
            content_type="video/mp4"
        )
        
        video_asset = storage_service.store_uploaded_video(video_file)
        self.assertIn("videos", video_asset.storage_path)
        self.assertTrue(video_asset.storage_path.endswith(".mp4"))
