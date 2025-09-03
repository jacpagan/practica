import pytest
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status
from core.models import VideoAsset
from exercises.models import Exercise
from comments.models import VideoComment
from model_bakery import baker
from tests.factories import TestDataFactory


class VideoCommentAPITest(APITestCase):
    def setUp(self):
        self.user = baker.make(User, is_staff=False)
        self.admin_user = baker.make(User, is_staff=True)
        self.video_asset = baker.make(VideoAsset)
        self.exercise = baker.make(Exercise, video_asset=self.video_asset, created_by=self.admin_user)
        self.comment = baker.make(VideoComment, exercise=self.exercise, author=self.user, video_asset=self.video_asset)
        
        # Create test video files using factory
        video_file_path = TestDataFactory.create_test_video_file('.mp4', 1024)
        with open(video_file_path, 'rb') as f:
            video_content = f.read()
        
        self.video_file = SimpleUploadedFile(
            "comment.mp4",
            video_content,
            content_type="video/mp4"
        )
        
        new_video_file_path = TestDataFactory.create_test_video_file('.mp4', 1024)
        with open(new_video_file_path, 'rb') as f:
            new_video_content = f.read()
        
        self.new_video_file = SimpleUploadedFile(
            "new_comment.mp4",
            new_video_content,
            content_type="video/mp4"
        )

    def test_authenticated_user_can_create_comment(self):
        """Test that authenticated users can create comments with video"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'exercise_id': str(self.exercise.id),
            'text': 'This is a test comment',
            'video': self.video_file
        }
        
        response = self.client.post('/comments/video-comments/', data, format='multipart')
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Response content: {response.content}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(VideoComment.objects.count(), 2)

    def test_comment_requires_video(self):
        """Test that comment creation requires video file"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'exercise_id': str(self.exercise.id),
            'text': 'This should fail without video'
        }
        
        response = self.client.post('/comments/video-comments/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comment_requires_exercise_id(self):
        """Test that comment creation requires exercise_id"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'text': 'This should fail without exercise_id',
            'video': self.video_file
        }
        
        response = self.client.post('/comments/video-comments/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comment_text_is_optional(self):
        """Test that comment text is optional"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'exercise_id': str(self.exercise.id),
            'video': self.video_file
        }
        
        response = self.client.post('/comments/video-comments/', data, format='multipart')
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Response content: {response.content}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_authenticated_user_can_read_comment_list(self):
        """Test that authenticated users can read comment list"""
        self.client.force_authenticate(user=self.user)
        
        # Debug: Check how many comments exist
        print(f"Total comments in database: {VideoComment.objects.count()}")
        print(f"Comments for this exercise: {VideoComment.objects.filter(exercise=self.exercise).count()}")
        
        response = self.client.get('/comments/video-comments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        print(f"Response data: {response.data}")
        self.assertEqual(len(response.data['results']), 1)

    def test_authenticated_user_can_read_comment_detail(self):
        """Test that authenticated users can read comment detail"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get(f'/comments/video-comments/{self.comment.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['text'], self.comment.text)

    def test_comment_filter_by_exercise(self):
        """Test that comments can be filtered by exercise"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get(f'/comments/video-comments/?exercise={self.exercise.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_author_can_update_own_comment(self):
        """Test that authors can update their own comments"""
        self.client.force_authenticate(user=self.user)
        
        data = {'text': 'Updated comment text'}
        response = self.client.patch(f'/comments/video-comments/{self.comment.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.text, 'Updated comment text')

    def test_author_can_replace_own_comment_video(self):
        """Test that authors can replace their own comment videos"""
        self.client.force_authenticate(user=self.user)
        
        data = {'video': self.new_video_file}
        response = self.client.patch(f'/comments/video-comments/{self.comment.id}/', data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_author_cannot_update_comment(self):
        """Test that non-authors cannot update comments"""
        other_user = baker.make(User)
        self.client.force_authenticate(user=other_user)
        
        data = {'text': 'This should fail'}
        response = self.client.patch(f'/comments/video-comments/{self.comment.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_any_comment(self):
        """Test that admin users can update any comment"""
        self.client.force_authenticate(user=self.admin_user)
        
        data = {'text': 'Admin updated this comment'}
        response = self.client.patch(f'/comments/video-comments/{self.comment.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.text, 'Admin updated this comment')

    def test_author_can_delete_own_comment(self):
        """Test that authors can delete their own comments"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.delete(f'/comments/video-comments/{self.comment.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(VideoComment.objects.count(), 0)

    def test_admin_can_delete_any_comment(self):
        """Test that admin users can delete any comment"""
        self.client.force_authenticate(user=self.admin_user)
        
        response = self.client.delete(f'/comments/video-comments/{self.comment.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(VideoComment.objects.count(), 0)

    def test_comment_ordering(self):
        """Test comment ordering"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get('/comments/video-comments/?ordering=-created_at')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
