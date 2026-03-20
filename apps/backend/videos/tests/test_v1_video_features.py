from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, Session, SessionAsset, VideoFeedback


@override_settings(AWS_STORAGE_BUCKET_NAME='')
class V1VideoFeaturesTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner-v1', password='pass1234')
        self.viewer = User.objects.create_user(username='viewer-v1', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Owner V1')
        Profile.objects.create(user=self.viewer, display_name='Viewer V1')

    def _video_file(self, name='clip.mp4', content_type='video/mp4'):
        return SimpleUploadedFile(name, b'video-data', content_type=content_type)

    def _create_session(self, user=None, title='Session 1'):
        return Session.objects.create(
            user=user or self.owner,
            title=title,
            description='',
            video_file=self._video_file(),
            processing_status=Session.STATUS_READY,
        )

    def test_video_feedback_requires_video(self):
        session = self._create_session(user=self.owner)
        self.client.force_authenticate(user=self.owner)

        no_video = self.client.post(
            f'/api/sessions/{session.id}/video-feedback/',
            {'text': 'text-only'},
            format='multipart',
        )
        self.assertEqual(no_video.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('required', no_video.data['error'].lower())

        with_video = self.client.post(
            f'/api/sessions/{session.id}/video-feedback/',
            {'text': '', 'feedback_video': self._video_file('reply.mp4')},
            format='multipart',
        )
        self.assertEqual(with_video.status_code, status.HTTP_201_CREATED)
        feedback = VideoFeedback.objects.latest('id')
        self.assertEqual(feedback.text, '')
        self.assertFalse(feedback.is_legacy_text_feedback)
        self.assertTrue(bool(feedback.feedback_video))

    def test_legacy_text_only_video_feedback_remains_visible(self):
        session = self._create_session()
        legacy = VideoFeedback.objects.create(
            session=session,
            user=self.owner,
            text='Legacy',
            feedback_video='',
            is_legacy_text_feedback=True,
        )
        self.client.force_authenticate(user=self.owner)

        detail = self.client.get(f'/api/sessions/{session.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['id'] == legacy.id for item in detail.data['video_feedback']))

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    def test_session_create_falls_back_to_ready_with_proxy_asset(self):
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            '/api/sessions/',
            {
                'title': 'Uploaded Session',
                'description': 'desc',
                'video_file': self._video_file('uploaded.mp4'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=res.data['id'])
        self.assertEqual(created.processing_status, Session.STATUS_READY)
        self.assertTrue(created.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4).exists())

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    def test_session_create_rejects_non_video_uploads(self):
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            '/api/sessions/',
            {
                'title': 'Invalid Upload',
                'description': 'not a video',
                'video_file': SimpleUploadedFile('notes.txt', b'hello', content_type='text/plain'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('only video files allowed', str(res.data).lower())

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    @patch('videos.views.enqueue_local_session_transcode', return_value=(False, 'ffmpeg missing'))
    def test_mov_session_without_transcoding_fails_with_clear_message(self, enqueue_local_transcode):
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            '/api/sessions/',
            {
                'title': 'Uploaded MOV Session',
                'description': 'mov',
                'video_file': self._video_file('uploaded.mov', content_type='video/quicktime'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=res.data['id'])
        self.assertEqual(created.processing_status, Session.STATUS_FAILED)
        self.assertIn('browser playback needs transcoding', created.processing_error.lower())
        enqueue_local_transcode.assert_called_once()

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    @patch('videos.views.enqueue_local_session_transcode', return_value=(True, ''))
    def test_mov_session_uses_local_transcode_fallback_when_available(self, enqueue_local_transcode):
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            '/api/sessions/',
            {
                'title': 'Queued MOV Session',
                'description': 'mov',
                'video_file': self._video_file('queued.mov', content_type='video/quicktime'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=res.data['id'])
        self.assertEqual(created.processing_status, Session.STATUS_PROCESSING)
        enqueue_local_transcode.assert_called_once()

    @override_settings(MEDIA_PROCESSING_CALLBACK_TOKEN='callback-secret')
    def test_processing_update_endpoint_upserts_assets(self):
        session = self._create_session()
        session.processing_status = Session.STATUS_PROCESSING
        session.save(update_fields=['processing_status'])

        payload = {
            'status': 'ready',
            'assets': [
                {
                    'asset_type': 'proxy_mp4',
                    'object_key': 'processed/sessions/1/proxy/video_proxy.mp4',
                    'content_type': 'video/mp4',
                    'metadata_json': {'width': 960, 'height': 540},
                },
            ],
        }

        res = self.client.post(
            f'/api/sessions/{session.id}/processing-update/',
            payload,
            format='json',
            HTTP_X_PROCESSING_TOKEN='callback-secret',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        session.refresh_from_db()
        self.assertEqual(session.processing_status, Session.STATUS_READY)
        self.assertEqual(session.assets.count(), 1)
