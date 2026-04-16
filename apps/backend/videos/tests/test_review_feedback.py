from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewLink, ReviewRequest, Session, VideoFeedback


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
            processing_status=Session.STATUS_READY,
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

    def _create_review_request(self):
        return ReviewRequest.objects.create(
            session=self.session,
            student=self.owner,
            reviewer=self.reviewer,
            created_by=self.owner,
            review_link=self.link,
            instrument='drums',
            goal='Lock the groove',
            status=ReviewRequest.STATUS_REQUESTED,
        )

    def test_review_link_info_returns_public_preview_without_login(self):
        response = self.client.get(f'/api/review/{self.link.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['session']['title'], self.session.title)
        self.assertEqual(response.data['link']['token'], self.link.token)
        self.assertTrue(response.data['auth_required'])

    def test_private_link_feedback_requires_login(self):
        response = self.client.get(f'/api/review/{self.link.token}/feedback/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_private_link_feedback_requires_video(self):
        self._auth(self.reviewer)
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {'text': ''},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('video is required', response.data['error'].lower())

    def test_feedback_author_can_update_own_feedback_via_review_link(self):
        feedback = VideoFeedback.objects.create(
            session=self.session,
            user=self.reviewer,
            text='Original note',
            feedback_category='timing',
            timestamp_seconds=12,
            feedback_video=self._video_file('original.mp4'),
            is_legacy_text_feedback=False,
        )
        self._auth(self.reviewer)

        response = self.client.patch(
            f'/api/review/{self.link.token}/feedback/',
            {
                'feedback_id': feedback.id,
                'text': 'Updated note',
                'feedback_category': 'technique',
                'timestamp_seconds': 30,
                'feedback_video': self._video_file('updated.mp4'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        feedback.refresh_from_db()
        self.assertEqual(feedback.text, 'Updated note')
        self.assertEqual(feedback.feedback_category, 'technique')
        self.assertEqual(feedback.timestamp_seconds, 30)
        self.assertTrue(bool(feedback.feedback_video))

    def test_feedback_author_can_delete_own_feedback_via_review_link(self):
        feedback = VideoFeedback.objects.create(
            session=self.session,
            user=self.reviewer,
            text='',
            feedback_video=self._video_file('original.mp4'),
            is_legacy_text_feedback=False,
        )
        self._auth(self.reviewer)

        response = self.client.delete(
            f'/api/review/{self.link.token}/feedback/',
            {'feedback_id': feedback.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'ok': True})
        self.assertFalse(VideoFeedback.objects.filter(pk=feedback.id).exists())

    def test_other_user_cannot_update_someone_elses_feedback_via_review_link(self):
        other_user = User.objects.create_user(username='other-reviewer', password='pass1234')
        Profile.objects.create(user=other_user, display_name='Other Reviewer')
        feedback = VideoFeedback.objects.create(
            session=self.session,
            user=self.reviewer,
            text='',
            feedback_video=self._video_file('original.mp4'),
            is_legacy_text_feedback=False,
        )
        self._auth(other_user)

        response = self.client.patch(
            f'/api/review/{self.link.token}/feedback/',
            {'feedback_id': feedback.id, 'feedback_video': self._video_file('not-yours.mp4')},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authenticated_reviewer_can_post_video_feedback(self):
        review_request = self._create_review_request()
        self._auth(self.reviewer)
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {
                'text': 'Watch the shoulder alignment here.',
                'feedback_category': 'posture',
                'timestamp_seconds': 25,
                'feedback_video': self._video_file(),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['author_display_name'], 'Helpful Reviewer')
        self.assertEqual(response.data['text'], 'Watch the shoulder alignment here.')
        self.assertEqual(response.data['feedback_category'], 'posture')
        self.assertEqual(response.data['timestamp_seconds'], 25)
        self.assertTrue(bool(response.data['feedback_video']))

        feedback = VideoFeedback.objects.get(session=self.session)
        self.assertEqual(feedback.user, self.reviewer)
        self.assertEqual(feedback.text, 'Watch the shoulder alignment here.')
        self.assertEqual(feedback.feedback_category, 'posture')
        self.assertEqual(feedback.timestamp_seconds, 25)
        self.assertFalse(feedback.is_legacy_text_feedback)

        detail_response = self.client.get(f'/api/review-requests/{review_request.id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['resolution']['code'], 'waiting_on_owner')
        self.assertEqual(detail_response.data['resolution']['phase'], 'waiting')
        self.assertEqual(detail_response.data['resolution']['awaiting_actor'], 'owner')
        self.assertEqual(detail_response.data['resolution']['occurred_label'], 'Responded')
        self.assertTrue(bool(detail_response.data['resolution']['occurred_at']))

    @patch('videos.reviews.api.logger')
    def test_first_structured_response_emits_product_event_log(self, logger_mock):
        self._create_review_request()
        self._auth(self.reviewer)

        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {
                'text': 'First structured response',
                'feedback_category': 'timing',
                'timestamp_seconds': 18,
                'feedback_video': self._video_file('first-response.mp4'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        logger_mock.info.assert_called_once()
        call_args = logger_mock.info.call_args.args
        self.assertEqual(call_args[1], 'reviewer_first_response_submitted')
        self.assertEqual(call_args[-1]['action'], 'api_review_feedback_create')
        self.assertEqual(call_args[-1]['review_request_id'], response.data['review_request_id'])
        self.assertEqual(call_args[-1]['category'], 'timing')
        self.assertEqual(call_args[-1]['response_mode'], 'video')

    def test_feedback_post_is_idempotent_for_client_upload_id(self):
        self._auth(self.reviewer)
        payload = {
            'text': 'Retry-safe upload',
            'timestamp_seconds': 12,
            'client_upload_id': 'retry-123',
            'feedback_video': self._video_file('retry.mp4'),
        }

        first = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            payload,
            format='multipart',
        )
        second = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            payload,
            format='multipart',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(VideoFeedback.objects.filter(session=self.session, user=self.reviewer, client_upload_id='retry-123').count(), 1)

    def test_authenticated_reviewer_can_post_android_video_feedback(self):
        self._auth(self.reviewer)
        response = self.client.post(
            f'/api/review/{self.link.token}/feedback/',
            {
                'text': 'Android clip',
                'feedback_video': self._video_file('android-short.mp4', content_type='application/mp4'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(bool(response.data['feedback_video']))

    def test_feedback_author_can_update_with_generic_3gpp_upload(self):
        feedback = VideoFeedback.objects.create(
            session=self.session,
            user=self.reviewer,
            text='Original note',
            timestamp_seconds=12,
            feedback_video=self._video_file('original.mp4'),
            is_legacy_text_feedback=False,
        )
        self._auth(self.reviewer)

        with patch(
            'videos.reviews.api.prepare_feedback_video_upload',
            return_value=self._video_file('updated-browser.mp4', content_type='video/mp4'),
        ):
            response = self.client.patch(
                f'/api/review/{self.link.token}/feedback/',
                {
                    'feedback_id': feedback.id,
                    'feedback_video': self._video_file('updated.3gpp', content_type='application/octet-stream'),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        feedback.refresh_from_db()
        self.assertTrue(feedback.feedback_video.name.endswith('.mp4'))

    def test_review_link_feedback_returns_clear_error_when_conversion_is_unavailable(self):
        self._auth(self.reviewer)

        with patch(
            'videos.reviews.api.prepare_feedback_video_upload',
            side_effect=ValueError('This feedback video needs browser playback conversion before Chrome and iPhone can open it, but conversion is unavailable right now. Please upload an MP4 or try again later.'),
        ):
            response = self.client.post(
                f'/api/review/{self.link.token}/feedback/',
                {
                    'text': 'Needs conversion',
                    'feedback_video': self._video_file('iphone.mov', content_type='video/quicktime'),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('chrome and iphone', response.data['error'].lower())

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

    def test_session_detail_falls_back_to_file_names_when_storage_url_fails(self):
        VideoFeedback.objects.create(
            session=self.session,
            user=self.reviewer,
            text='Video reply note',
            timestamp_seconds=10,
            feedback_video='feedback_videos/reply.mp4',
            is_legacy_text_feedback=False,
        )
        self._auth(self.owner)

        with patch('django.core.files.storage.FileSystemStorage.url', side_effect=RuntimeError('storage unavailable')):
            response = self.client.get(f'/api/sessions/{self.session.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['video_file'].endswith('/sessions/review-owner.mp4'))
        self.assertTrue(response.data['video_feedback'][0]['feedback_video'].endswith('/feedback_videos/reply.mp4'))

    def test_owner_can_create_and_reuse_private_share_link(self):
        self.link.is_active = False
        self.link.save(update_fields=['is_active'])
        self._auth(self.owner)

        first = self.client.post(f'/api/sessions/{self.session.id}/share/')
        second = self.client.post(f'/api/sessions/{self.session.id}/share/')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data['token'], second.data['token'])
        self.assertIn('/r/', first.data['url'])

    def test_owner_can_revoke_private_share_link_via_delete_share_route(self):
        self._auth(self.owner)

        response = self.client.delete(f'/api/sessions/{self.session.id}/share/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'ok': True})
        self.link.refresh_from_db()
        self.assertFalse(self.link.is_active)

    def test_revoked_private_link_returns_forbidden_with_specific_code(self):
        self.link.is_active = False
        self.link.save(update_fields=['is_active'])
        self._auth(self.reviewer)

        response = self.client.get(f'/api/review/{self.link.token}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'review_link_revoked')
        self.assertIn('turned off', response.data['error'].lower())

    def test_delete_share_route_returns_revoked_code_on_followup_access(self):
        self._auth(self.owner)
        revoke_response = self.client.delete(f'/api/sessions/{self.session.id}/share/')
        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)

        self._auth(self.reviewer)
        response = self.client.get(f'/api/review/{self.link.token}/feedback/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'review_link_revoked')

    def test_owner_cannot_create_private_share_link_until_session_is_ready(self):
        self.link.is_active = False
        self.link.save(update_fields=['is_active'])
        self.session.processing_status = Session.STATUS_PROCESSING
        self.session.save(update_fields=['processing_status'])
        self._auth(self.owner)

        response = self.client.post(f'/api/sessions/{self.session.id}/share/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('playback ready', response.data['error'].lower())

    def test_expired_private_link_returns_gone_with_specific_code(self):
        self.link.expires_at = timezone.now() - timedelta(minutes=1)
        self.link.save(update_fields=['expires_at'])
        self._auth(self.reviewer)

        response = self.client.get(f'/api/review/{self.link.token}/')

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data['code'], 'review_link_expired')
        self.assertIn('expired', response.data['error'].lower())

    def test_invalid_private_link_returns_not_found_with_specific_code(self):
        self._auth(self.reviewer)

        response = self.client.get('/api/review/not-a-real-link/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['code'], 'review_link_invalid')
        self.assertIn('does not exist', response.data['error'].lower())
