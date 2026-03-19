from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewLink, Session, VideoFeedback


class ReviewFeedbackApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='review-owner', password='pass1234')
        self.reviewer = User.objects.create_user(username='reviewer-user', password='pass1234', email='reviewer@example.com')
        Profile.objects.create(user=self.owner, display_name='Review Owner')
        Profile.objects.create(user=self.reviewer, display_name='Helpful Reviewer')
        self.session = Session.objects.create(
            user=self.owner,
            title='Review Session',
            description='Session to test private video feedback',
            video_file='sessions/review-owner.mp4',
            duration_seconds=120,
        )
        self.link = ReviewLink.objects.create(
            session=self.session,
            token='review-token-123',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _video_file(self, name='feedback.mp4', content_type='video/mp4'):
        return SimpleUploadedFile(name, b'video-feedback-data', content_type=content_type)

    def test_review_link_info_requires_login(self):
        response = self.client.get(f'/api/review/{self.link.token}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_private_link_feedback_requires_login(self):
        response = self.client.get(f'/api/review/{self.link.token}/feedback/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_private_link_feedback_requires_video(self):
        self._auth(self.reviewer)
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {'text': 'This should fail without video.'},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('required', response.data['error'].lower())

    def test_authenticated_reviewer_can_post_video_feedback(self):
        self._auth(self.reviewer)
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {
                'text': 'Watch the shoulder alignment here.',
                'timestamp_seconds': 25,
                'feedback_video': self._video_file(),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['author_display_name'], 'Helpful Reviewer')
        self.assertEqual(response.data['timestamp_seconds'], 25)
        self.assertTrue(bool(response.data['feedback_video']))

        feedback = VideoFeedback.objects.get(session=self.session)
        self.assertEqual(feedback.user, self.reviewer)
        self.assertEqual(feedback.timestamp_seconds, 25)
        self.assertFalse(feedback.is_legacy_text_feedback)

    def test_session_detail_includes_video_feedback(self):
        VideoFeedback.objects.create(
            session=self.session,
            user=self.reviewer,
            text='Video reply note',
            timestamp_seconds=10,
            feedback_video=self._video_file('reply.mp4'),
            is_legacy_text_feedback=False,
        )
        self._auth(self.owner)

        response = self.client.get(f'/api/sessions/{self.session.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['video_feedback']), 1)
        self.assertEqual(response.data['video_feedback'][0]['text'], 'Video reply note')
        self.assertTrue(bool(response.data['video_feedback'][0]['feedback_video']))

    def test_owner_can_create_and_reuse_private_share_link(self):
        self._auth(self.owner)

        first = self.client.post(f'/api/sessions/{self.session.id}/share/')
        second = self.client.post(f'/api/sessions/{self.session.id}/share/')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['token'], second.data['token'])
        self.assertIn('/r/', first.data['url'])
