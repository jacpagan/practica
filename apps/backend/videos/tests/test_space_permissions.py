from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, Session, Space, SpaceMember


class SpacePermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='space-owner', password='pass1234')
        self.member = User.objects.create_user(username='space-member', password='pass1234')

        Profile.objects.create(user=self.owner, display_name='Owner')
        Profile.objects.create(user=self.member, display_name='Member')

        self.space = Space.objects.create(name='Drumming', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)

    def _video_file(self, name='clip.mp4'):
        return SimpleUploadedFile(name, b'video-data', content_type='video/mp4')

    def test_member_cannot_patch_or_delete_space(self):
        self.client.force_authenticate(user=self.member)

        patch_response = self.client.patch(
            f'/api/spaces/{self.space.id}/',
            {'name': 'Renamed by member'},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)

        delete_response = self.client.delete(f'/api/spaces/{self.space.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

        self.space.refresh_from_db()
        self.assertEqual(self.space.name, 'Drumming')

    def test_owner_can_patch_and_delete_space(self):
        self.client.force_authenticate(user=self.owner)

        patch_response = self.client.patch(
            f'/api/spaces/{self.space.id}/',
            {'name': 'Owner renamed'},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        self.space.refresh_from_db()
        self.assertEqual(self.space.name, 'Owner renamed')

        delete_response = self.client.delete(f'/api/spaces/{self.space.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Space.objects.filter(id=self.space.id).exists())

    def test_member_can_create_session_in_joined_space(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            '/api/sessions/',
            {
                'title': 'Space Session',
                'description': 'Created by member',
                'video_file': self._video_file('member.mp4'),
                'space': self.space.id,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=response.data['id'])
        self.assertEqual(created.user_id, self.member.id)
        self.assertEqual(created.space_id, self.space.id)
