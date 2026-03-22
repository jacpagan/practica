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


class InviteCodeApiTests(APITestCase):
    def setUp(self):
        self.member = User.objects.create_user(username='member-user', password='pass1234')

    def _auth(self):
        self.client.force_authenticate(user=self.member)

    def test_member_can_create_single_use_invite_code(self):
        self._auth()

        response = self.client.post('/api/invite-codes/', {'label': 'Friend invite'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['label'], 'Friend invite')
        self.assertEqual(response.data['max_uses'], 1)
        self.assertTrue(bool(response.data['code']))

    def test_member_can_list_own_invite_codes(self):
        SignupInviteCode.objects.create(code='ONE123', created_by=self.member)
        self._auth()

        response = self.client.get('/api/invite-codes/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['code'], 'ONE123')

    def test_member_can_turn_off_own_invite_code(self):
        invite = SignupInviteCode.objects.create(code='ONE123', created_by=self.member)
        self._auth()

        response = self.client.delete(f'/api/invite-codes/{invite.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        invite.refresh_from_db()
        self.assertFalse(invite.is_active)
