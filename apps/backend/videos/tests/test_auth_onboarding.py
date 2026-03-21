from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import SignupInviteCode


class AuthOnboardingTests(APITestCase):
    def test_register_requires_invite_code(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new-user',
                'password': 'pass1234',
                'display_name': 'New User',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invite_code', response.data)

    def test_register_rejects_invalid_invite_code(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new-user',
                'password': 'pass1234',
                'display_name': 'New User',
                'invite_code': 'NOTREAL',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invite_code', response.data)

    def test_register_accepts_valid_invite_code_and_consumes_it(self):
        invite = SignupInviteCode.objects.create(code='DRUMS123', max_uses=1)

        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new-user',
                'password': 'pass1234',
                'display_name': 'New User',
                'invite_code': 'DRUMS123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='new-user').exists())
        invite.refresh_from_db()
        self.assertEqual(invite.use_count, 1)

    def test_exhausted_invite_code_cannot_be_reused(self):
        invite = SignupInviteCode.objects.create(code='DRUMS123', max_uses=1, use_count=1)

        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new-user',
                'password': 'pass1234',
                'display_name': 'New User',
                'invite_code': invite.code,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invite_code', response.data)
