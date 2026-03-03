from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, Session, Space, SpaceMember


class AuthOnboardingApiTests(APITestCase):
    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_register_without_invite_is_allowed(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new-user',
                'password': 'pass1234',
                'display_name': 'New User',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['user']['username'], 'new-user')
        self.assertEqual(response.data['user']['has_spaces'], False)
        self.assertEqual(response.data['user']['joined_spaces_count'], 0)
        self.assertNotIn('feedback_requests_enabled', response.data['user'])

    def test_register_with_invalid_invite_code_is_rejected(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'bad-invite-user',
                'password': 'pass1234',
                'display_name': 'Bad Invite',
                'invite_code': 'INVALID1',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invite_code', response.data)

    def test_me_includes_onboarding_fields(self):
        user = User.objects.create_user(username='onboard-me', password='pass1234')
        Profile.objects.create(user=user, display_name='Onboard Me')
        self._auth(user)

        empty_response = self.client.get('/api/auth/me/')
        self.assertEqual(empty_response.status_code, status.HTTP_200_OK)
        self.assertFalse(empty_response.data['has_spaces'])
        self.assertEqual(empty_response.data['joined_spaces_count'], 0)
        self.assertNotIn('feedback_requests_enabled', empty_response.data)

        owned_space = Space.objects.create(name='Owned Space', owner=user)
        other_owner = User.objects.create_user(username='other-owner', password='pass1234')
        Profile.objects.create(user=other_owner, display_name='Other Owner')
        joined_space = Space.objects.create(name='Joined Space', owner=other_owner)
        SpaceMember.objects.create(space=joined_space, user=user)

        filled_response = self.client.get('/api/auth/me/')
        self.assertEqual(filled_response.status_code, status.HTTP_200_OK)
        self.assertTrue(filled_response.data['has_spaces'])
        self.assertEqual(filled_response.data['joined_spaces_count'], 1)
        self.assertNotIn('feedback_requests_enabled', filled_response.data)

        # Keep references used to ensure objects exist in DB for this test case.
        self.assertEqual(owned_space.owner_id, user.id)


class SessionPayloadFlagsApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner-flags', password='pass1234')
        self.member = User.objects.create_user(username='member-flags', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Owner Flags')
        Profile.objects.create(user=self.member, display_name='Member Flags')

        self.space = Space.objects.create(name='Flags Space', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)
        self.session = Session.objects.create(
            user=self.owner,
            space=self.space,
            title='Flags Session',
            description='Session payload flags',
            video_file='sessions/seed.mp4',
        )

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _fetch_list_item(self):
        list_response = self.client.get('/api/sessions/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        payload = list_response.data
        if isinstance(payload, dict):
            items = payload.get('results', [])
        else:
            items = payload
        self.assertTrue(items)
        return items[0]

    def test_owner_sees_can_edit_and_feedback_fields_absent(self):
        self._auth(self.owner)
        me_response = self.client.get('/api/auth/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertNotIn('feedback_requests_enabled', me_response.data)

        list_item = self._fetch_list_item()
        detail_response = self.client.get(f'/api/sessions/{self.session.id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        self.assertTrue(list_item['can_edit'])
        self.assertNotIn('can_request_feedback', list_item)
        self.assertNotIn('open_feedback_request_count', list_item)

        self.assertTrue(detail_response.data['can_edit'])
        self.assertNotIn('can_request_feedback', detail_response.data)
        self.assertNotIn('open_feedback_requests', detail_response.data)
        self.assertNotIn('open_feedback_request_count', detail_response.data)

    def test_member_sees_read_only_flags_and_feedback_fields_absent(self):
        self._auth(self.member)
        list_item = self._fetch_list_item()
        detail_response = self.client.get(f'/api/sessions/{self.session.id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        self.assertFalse(list_item['can_edit'])
        self.assertNotIn('can_request_feedback', list_item)
        self.assertNotIn('open_feedback_request_count', list_item)

        self.assertFalse(detail_response.data['can_edit'])
        self.assertNotIn('can_request_feedback', detail_response.data)
        self.assertNotIn('open_feedback_requests', detail_response.data)
        self.assertNotIn('open_feedback_request_count', detail_response.data)
