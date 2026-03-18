from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewFeedback, ReviewLink, Session, Space


class ReviewFeedbackApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='review-owner', password='pass1234')
        self.teacher = User.objects.create_user(username='review-teacher', password='pass1234', email='teacher@example.com')
        Profile.objects.create(user=self.owner, display_name='Review Owner')
        Profile.objects.create(user=self.teacher, display_name='Teacher Coach')
        self.session = Session.objects.create(
            user=self.owner,
            title='Review Session',
            description='Session to test public feedback',
            video_file='sessions/review-owner.mp4',
            duration_seconds=120,
        )
        self.space = Space.objects.create(name='Teacher Space', owner=self.teacher)
        self.session.space = self.space
        self.session.save(update_fields=['space'])
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

    def test_session_detail_includes_active_review_link_for_owner(self):
        self._auth(self.owner)

        response = self.client.post(f'/api/sessions/{self.session.id}/share/')
        self.assertIn(response.status_code, {status.HTTP_200_OK, status.HTTP_201_CREATED})

        detail = self.client.get(f'/api/sessions/{self.session.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(detail.data['active_review_link'])
        self.assertIn('/r/', detail.data['active_review_link']['url'])

    def test_create_share_link_reuses_existing_active_link(self):
        self._auth(self.owner)

        first = self.client.post(f'/api/sessions/{self.session.id}/share/')
        second = self.client.post(f'/api/sessions/{self.session.id}/share/')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['token'], second.data['token'])

    def test_owner_can_update_and_delete_public_feedback(self):
        item = ReviewFeedback.objects.create(
            session=self.session,
            review_link=self.link,
            name='Coach',
            timestamp_seconds=25,
            text='Initial note',
        )
        self._auth(self.owner)

        update_response = self.client.patch(
            f'/api/sessions/{self.session.id}/review-feedback/{item.id}/',
            {'text': 'Updated note', 'timestamp_seconds': 40},
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['text'], 'Updated note')
        self.assertEqual(update_response.data['timestamp_seconds'], 40)

        delete_response = self.client.delete(f'/api/sessions/{self.session.id}/review-feedback/{item.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ReviewFeedback.objects.filter(id=item.id).exists())

    def test_space_owner_can_leave_feedback_directly(self):
        self._auth(self.teacher)

        response = self.client.post(
            f'/api/sessions/{self.session.id}/review-feedback/',
            {'text': 'Focus on the groove at the start.', 'timestamp_seconds': 12},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Teacher Coach')
        self.assertEqual(response.data['timestamp_seconds'], 12)

    def test_session_detail_flags_teacher_can_review(self):
        self._auth(self.teacher)

        response = self.client.get(f'/api/sessions/{self.session.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_review_feedback'])
