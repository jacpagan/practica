from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, Space, SpaceMember


class SpacePermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='space-owner', password='pass1234')
        self.member = User.objects.create_user(username='space-member', password='pass1234')

        Profile.objects.create(user=self.owner, display_name='Owner')
        Profile.objects.create(user=self.member, display_name='Member')

        self.space = Space.objects.create(name='Drumming', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)

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
