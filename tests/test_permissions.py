import pytest
from django.test import TestCase, RequestFactory
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from core.models import VideoAsset
from exercises.models import Exercise
from exercises.permissions import IsAdminForExercise
from comments.models import VideoComment
from comments.permissions import IsAuthorOrAdmin
from model_bakery import baker


class ExercisePermissionsTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = baker.make(User, is_staff=False)
        self.admin_user = baker.make(User, is_staff=True)
        self.video_asset = baker.make(VideoAsset)
        self.exercise = baker.make(Exercise, video_asset=self.video_asset, created_by=self.admin_user)
        self.permission = IsAdminForExercise()

    def test_staff_can_create_exercise(self):
        """Test that staff users can create exercises"""
        request = self.factory.post('/api/v1/exercises/')
        request.user = self.admin_user
        
        self.assertTrue(self.permission.has_permission(request, None))

    def test_non_staff_cannot_create_exercise(self):
        """Test that non-staff users cannot create exercises"""
        request = self.factory.post('/api/v1/exercises/')
        request.user = self.user
        
        self.assertFalse(self.permission.has_permission(request, None))

    def test_authenticated_user_can_read_exercise(self):
        """Test that authenticated users can read exercises"""
        request = self.factory.get('/api/v1/exercises/')
        request.user = self.user
        
        self.assertTrue(self.permission.has_permission(request, None))

    def test_staff_can_edit_exercise(self):
        """Test that staff users can edit exercises"""
        request = self.factory.patch('/api/v1/exercises/')
        request.user = self.admin_user
        
        self.assertTrue(self.permission.has_object_permission(request, None, self.exercise))

    def test_non_staff_cannot_edit_exercise(self):
        """Test that non-staff users cannot edit exercises"""
        request = self.factory.patch('/api/v1/exercises/')
        request.user = self.user
        
        self.assertFalse(self.permission.has_object_permission(request, None, self.exercise))


class VideoCommentPermissionsTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = baker.make(User, is_staff=False)
        self.admin_user = baker.make(User, is_staff=True)
        self.other_user = baker.make(User, is_staff=False)
        self.video_asset = baker.make(VideoAsset)
        self.exercise = baker.make(Exercise, video_asset=self.video_asset, created_by=self.admin_user)
        self.comment = baker.make(VideoComment, exercise=self.exercise, author=self.user, video_asset=self.video_asset)
        self.permission = IsAuthorOrAdmin()

    def test_authenticated_user_can_create_comment(self):
        """Test that authenticated users can create comments"""
        request = self.factory.post('/api/v1/video-comments/')
        request.user = self.user
        
        self.assertTrue(self.permission.has_permission(request, None))

    def test_authenticated_user_can_read_comment(self):
        """Test that authenticated users can read comments"""
        request = self.factory.get('/api/v1/video-comments/')
        request.user = self.user
        
        self.assertTrue(self.permission.has_permission(request, None))

    def test_author_can_edit_own_comment(self):
        """Test that authors can edit their own comments"""
        request = self.factory.patch('/api/v1/video-comments/')
        request.user = self.user
        
        self.assertTrue(self.permission.has_object_permission(request, None, self.comment))

    def test_non_author_cannot_edit_comment(self):
        """Test that non-authors cannot edit comments"""
        request = self.factory.patch('/api/v1/video-comments/')
        request.user = self.other_user
        
        self.assertFalse(self.permission.has_object_permission(request, None, self.comment))

    def test_admin_can_edit_any_comment(self):
        """Test that admin users can edit any comment"""
        request = self.factory.patch('/api/v1/video-comments/')
        request.user = self.admin_user
        
        self.assertTrue(self.permission.has_object_permission(request, None, self.comment))

    def test_author_can_delete_own_comment(self):
        """Test that authors can delete their own comments"""
        request = self.factory.delete('/api/v1/video-comments/')
        request.user = self.user
        
        self.assertTrue(self.permission.has_object_permission(request, None, self.comment))

    def test_admin_can_delete_any_comment(self):
        """Test that admin users can delete any comment"""
        request = self.factory.delete('/api/v1/video-comments/')
        request.user = self.admin_user
        
        self.assertTrue(self.permission.has_object_permission(request, None, self.comment))
