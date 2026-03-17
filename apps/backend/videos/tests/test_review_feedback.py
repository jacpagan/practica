from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewFeedback, ReviewLink, Session


class ReviewFeedbackApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='review-owner', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Review Owner')
        self.session = Session.objects.create(
            user=self.owner,
            title='Review Session',
            description='Session to test public feedback',
            video_file='sessions/review-owner.mp4',
            duration_seconds=120,
        )
        self.link = ReviewLink.objects.create(
            session=self.session,
            token='review-token-123',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_comments=True,
        )

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_session_detail_includes_public_review_feedback(self):
        ReviewFeedback.objects.create(
            session=self.session,
            review_link=self.link,
            name='Coach',
            timestamp_seconds=33,
            text='Nice work here.',
        )
        self._auth(self.owner)

        response = self.client.get(f'/api/sessions/{self.session.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('review_feedback', response.data)
        self.assertEqual(len(response.data['review_feedback']), 1)
        self.assertEqual(response.data['review_feedback'][0]['text'], 'Nice work here.')
        self.assertEqual(response.data['review_feedback'][0]['timestamp_seconds'], 33)

    def test_public_review_feedback_rejects_timestamp_outside_video_duration(self):
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {
                'name': 'Coach',
                'timestamp_seconds': 121,
                'text': 'Too late in the video',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('timestamp_seconds', response.data)

    def test_public_review_feedback_accepts_valid_timestamp(self):
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {
                'name': 'Coach',
                'timestamp_seconds': 90,
                'text': 'Great motion here',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['timestamp_seconds'], 90)
