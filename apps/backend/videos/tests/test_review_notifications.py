from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewRequest, ReviewerRosterMembership, Session


@override_settings(
    EMAIL_NOTIFICATIONS_ENABLED=True,
    APP_BASE_URL='https://practica.test',
    DEFAULT_FROM_EMAIL='no-reply@practica.test',
)
class ReviewNotificationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='notification-owner', password='pass1234', email='owner@example.com')
        self.reviewer = User.objects.create_user(username='notification-reviewer', password='pass1234', email='reviewer@example.com')
        Profile.objects.create(user=self.owner, display_name='Notification Owner')
        Profile.objects.create(user=self.reviewer, display_name='Notification Reviewer')
        self.session = Session.objects.create(
            user=self.owner,
            title='Notification Take',
            description='Testing outbound review notifications',
            video_file='sessions/notification-take.mp4',
            duration_seconds=90,
            processing_status=Session.STATUS_READY,
        )
        ReviewerRosterMembership.objects.create(
            reviewer=self.reviewer,
            student=self.owner,
            created_by=self.owner,
            is_active=True,
        )

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _create_review_request(self):
        self._auth(self.owner)
        response = self.client.post(
            '/api/review-requests/',
            {
                'session_id': self.session.id,
                'reviewer_id': self.reviewer.id,
                'instrument': 'drums',
                'goal': 'Keep the groove steady',
                'notes': 'Watch the transition into the chorus.',
                'requested_turnaround_hours': 24,
                'deadline': (timezone.now() + timedelta(days=2)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        return response

    @patch('videos.services.notifications.send_mail')
    def test_review_request_creation_sends_email_to_reviewer(self, send_mail_mock):
        with patch('videos.reviews.services.transaction.on_commit', side_effect=lambda func: func()):
            response = self._create_review_request()

        send_mail_mock.assert_called_once()
        args, kwargs = send_mail_mock.call_args
        self.assertIn('new review request', kwargs['subject'].lower())
        self.assertEqual(kwargs['from_email'], 'no-reply@practica.test')
        self.assertEqual(kwargs['recipient_list'], ['reviewer@example.com'])
        self.assertIn('https://practica.test/requests', kwargs['message'])
        self.assertIn('https://practica.test/r/', kwargs['message'])
        self.assertEqual(response.data['notification_delivery']['status'], 'sent')
        self.assertIn('Email sent to Notification Reviewer', response.data['notification_delivery']['message'])

    @patch('videos.services.notifications.send_mail')
    def test_reviewer_response_sends_email_to_owner(self, send_mail_mock):
        with patch('videos.reviews.services.transaction.on_commit', side_effect=lambda func: func()):
            create_response = self._create_review_request()
        send_mail_mock.reset_mock()
        review_request = ReviewRequest.objects.get(pk=create_response.data['id'])

        self._auth(self.reviewer)
        with patch('videos.reviews.services.transaction.on_commit', side_effect=lambda func: func()):
            response = self.client.post(
                f'/api/review/{review_request.review_link.token}/feedback/',
                {
                    'text': 'Nice work on the pocket.',
                    'feedback_video': self._video_file('response.mp4'),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, 201)
        send_mail_mock.assert_called_once()
        args, kwargs = send_mail_mock.call_args
        self.assertIn('feedback received', kwargs['subject'].lower())
        self.assertEqual(kwargs['recipient_list'], ['owner@example.com'])
        self.assertIn('https://practica.test/requests', kwargs['message'])
        self.assertIn('https://practica.test/r/', kwargs['message'])

    @patch('videos.services.notifications.send_mail')
    def test_notification_is_skipped_when_recipient_has_no_email(self, send_mail_mock):
        self.reviewer.email = ''
        self.reviewer.save(update_fields=['email'])

        with patch('videos.reviews.services.transaction.on_commit', side_effect=lambda func: func()):
            response = self._create_review_request()

        send_mail_mock.assert_not_called()
        self.assertEqual(response.data['notification_delivery']['status'], 'missing_email')
        self.assertIn('No email on file', response.data['notification_delivery']['message'])

    def _video_file(self, name='feedback.mp4', content_type='video/mp4'):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(name, b'video-feedback-data', content_type=content_type)
