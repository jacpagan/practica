import pytest
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status
from core.models import VideoAsset
from exercises.models import Exercise
from model_bakery import baker


class ExerciseAPITest(APITestCase):
    def setUp(self):
        self.user = baker.make(User, is_staff=False)
        self.admin_user = baker.make(User, is_staff=True)
        self.video_asset = baker.make(VideoAsset)
        self.exercise = baker.make(Exercise, name="Test Exercise", video_asset=self.video_asset, created_by=self.admin_user)
        
        # Create a test video file
        self.video_file = SimpleUploadedFile(
            "test.mp4",
            b"fake video content",
            content_type="video/mp4"
        )

    def test_staff_can_create_exercise(self):
        """Test that staff users can create exercises with video"""
        self.client.force_authenticate(user=self.admin_user)
        
        data = {
            'name': 'New Exercise',
            'description': 'Test description',
            'video': self.video_file
        }
        
        response = self.client.post('/api/v1/exercises/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Exercise.objects.count(), 2)

    def test_non_staff_cannot_create_exercise(self):
        """Test that non-staff users cannot create exercises"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'name': 'New Exercise',
            'description': 'Test description',
            'video': self.video_file
        }
        
        response = self.client.post('/api/v1/exercises/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authenticated_user_can_read_exercise_list(self):
        """Test that authenticated users can read exercise list"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get('/api/v1/exercises/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_authenticated_user_can_read_exercise_detail(self):
        """Test that authenticated users can read exercise detail"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get(f'/api/v1/exercises/{self.exercise.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], self.exercise.name)

    def test_staff_can_update_exercise(self):
        """Test that staff users can update exercises"""
        self.client.force_authenticate(user=self.admin_user)
        
        data = {'name': 'Updated Exercise Name'}
        response = self.client.patch(f'/api/v1/exercises/{self.exercise.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.exercise.refresh_from_db()
        self.assertEqual(self.exercise.name, 'Updated Exercise Name')

    def test_non_staff_cannot_update_exercise(self):
        """Test that non-staff users cannot update exercises"""
        self.client.force_authenticate(user=self.user)
        
        data = {'name': 'Updated Exercise Name'}
        response = self.client.patch(f'/api/v1/exercises/{self.exercise.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_delete_exercise(self):
        """Test that staff users can delete exercises"""
        self.client.force_authenticate(user=self.admin_user)
        
        response = self.client.delete(f'/api/v1/exercises/{self.exercise.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Exercise.objects.count(), 0)

    def test_non_staff_cannot_delete_exercise(self):
        """Test that non-staff users cannot delete exercises"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.delete(f'/api/v1/exercises/{self.exercise.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_exercise_requires_video(self):
        """Test that exercise creation requires video file"""
        self.client.force_authenticate(user=self.admin_user)
        
        data = {
            'name': 'Exercise Without Video',
            'description': 'This should fail'
        }
        
        response = self.client.post('/api/v1/exercises/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_exercise_video_replacement(self):
        """Test that exercise video can be replaced"""
        self.client.force_authenticate(user=self.admin_user)
        
        new_video = SimpleUploadedFile(
            "new.mp4",
            b"new video content",
            content_type="video/mp4"
        )
        
        data = {'video': new_video}
        response = self.client.patch(f'/api/v1/exercises/{self.exercise.id}/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_exercise_search(self):
        """Test exercise search functionality"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get('/api/v1/exercises/?search=Exercise')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_exercise_ordering(self):
        """Test exercise ordering"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get('/api/v1/exercises/?ordering=-created_at')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
