from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, Session, SessionAsset, VideoFeedback
from videos.services.media_pipeline import _create_job_settings, sync_mediaconvert_session


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

    def test_video_feedback_accepts_android_3gpp_with_generic_content_type(self):
        session = self._create_session(user=self.owner)
        self.client.force_authenticate(user=self.owner)

        with patch(
            'videos.views.prepare_feedback_video_upload',
            return_value=self._video_file('reply-browser.mp4', content_type='video/mp4'),
        ):
            response = self.client.post(
                f'/api/sessions/{session.id}/video-feedback/',
                {
                    'text': 'Android upload',
                    'feedback_video': self._video_file('reply.3gpp', content_type='application/octet-stream'),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        feedback = VideoFeedback.objects.latest('id')
        self.assertTrue(feedback.feedback_video.name.endswith('.mp4'))

    @patch(
        'videos.views.prepare_feedback_video_upload',
        side_effect=ValueError('This feedback video needs browser playback conversion before Chrome and iPhone can open it, but conversion is unavailable right now. Please upload an MP4 or try again later.'),
    )
    def test_video_feedback_returns_clear_error_when_conversion_is_unavailable(self, prepare_feedback_video_upload):
        session = self._create_session(user=self.owner)
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            f'/api/sessions/{session.id}/video-feedback/',
            {
                'text': 'Needs conversion',
                'feedback_video': self._video_file('reply.mov', content_type='video/quicktime'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('chrome and iphone', response.data['error'].lower())
        prepare_feedback_video_upload.assert_called_once()

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

    def test_feedback_author_can_update_own_session_feedback(self):
        session = self._create_session(user=self.owner)
        feedback = VideoFeedback.objects.create(
            session=session,
            user=self.owner,
            text='Original note',
            timestamp_seconds=12,
            feedback_video=self._video_file('original.mp4'),
            is_legacy_text_feedback=False,
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.patch(
            f'/api/sessions/{session.id}/video-feedback/{feedback.id}/',
            {
                'timestamp_seconds': 30,
                'feedback_video': self._video_file('updated.mp4'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        feedback.refresh_from_db()
        self.assertEqual(feedback.timestamp_seconds, 30)
        self.assertTrue(bool(feedback.feedback_video))
        self.assertNotEqual(feedback.feedback_video.name, 'original.mp4')

    def test_feedback_author_can_delete_own_session_feedback(self):
        session = self._create_session(user=self.owner)
        feedback = VideoFeedback.objects.create(
            session=session,
            user=self.owner,
            text='',
            feedback_video=self._video_file('original.mp4'),
            is_legacy_text_feedback=False,
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.delete(f'/api/sessions/{session.id}/video-feedback/{feedback.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(VideoFeedback.objects.filter(pk=feedback.id).exists())

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    @patch('videos.views.enqueue_local_session_transcode', return_value=(False, 'ffmpeg missing'))
    def test_session_create_fails_when_conversion_is_unavailable(self, enqueue_local_transcode):
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
        self.assertEqual(created.processing_status, Session.STATUS_FAILED)
        self.assertIn('playback conversion is unavailable', created.processing_error.lower())
        enqueue_local_transcode.assert_called_once()

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    @patch('videos.views.enqueue_local_session_transcode', return_value=(True, ''))
    def test_session_create_accepts_android_mp4_with_application_mime(self, enqueue_local_transcode):
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            '/api/sessions/',
            {
                'title': 'Android Session',
                'description': 'uploaded from phone',
                'video_file': self._video_file('android-short.mp4', content_type='application/mp4'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=res.data['id'])
        self.assertEqual(created.processing_status, Session.STATUS_PROCESSING)
        enqueue_local_transcode.assert_called_once()

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='',
        AWS_MEDIA_CONVERT_ROLE_ARN='',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='',
    )
    @patch('videos.views.enqueue_local_session_transcode', return_value=(True, ''))
    def test_retry_processing_requeues_mobile_compatible_transcode(self, enqueue_local_transcode):
        session = Session.objects.create(
            user=self.owner,
            title='Android upload',
            description='',
            video_file='sessions/android-short.mp4',
            processing_status=Session.STATUS_READY,
        )
        session.assets.create(
            asset_type=SessionAsset.TYPE_PROXY_MP4,
            object_key='sessions/android-short.mp4',
            content_type='video/mp4',
            metadata_json={'source': 'original'},
        )

        self.client.force_authenticate(user=self.owner)
        res = self.client.post(f'/api/sessions/{session.id}/retry-processing/')

        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        session.refresh_from_db()
        self.assertEqual(session.processing_status, Session.STATUS_PROCESSING)
        enqueue_local_transcode.assert_called_once()

    def test_session_asset_urls_fall_back_to_media_urls_when_storage_lookup_fails(self):
        session = self._create_session(user=self.owner)
        SessionAsset.objects.create(
            session=session,
            asset_type=SessionAsset.TYPE_PROXY_MP4,
            object_key='processed/sessions/1/proxy/video_proxy.mp4',
            content_type='video/mp4',
        )
        self.client.force_authenticate(user=self.owner)

        with patch('django.core.files.storage.FileSystemStorage.url', side_effect=RuntimeError('storage unavailable')):
            response = self.client.get(f'/api/sessions/{session.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['assets']), 1)
        self.assertTrue(response.data['assets'][0]['url'].endswith('/processed/sessions/1/proxy/video_proxy.mp4'))

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

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_MEDIA_CONVERT_ROLE_ARN='arn:aws:iam::123456789012:role/practica-mediaconvert',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='https://mediaconvert.us-east-1.amazonaws.com',
    )
    @patch('videos.views.enqueue_session_processing', return_value=(True, '', 'mc-job-123'))
    def test_session_create_stores_mediaconvert_job_id(self, enqueue_session_processing):
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            '/api/sessions/',
            {
                'title': 'MediaConvert Session',
                'description': 'queued in managed pipeline',
                'video_file': self._video_file('uploaded.mp4'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=res.data['id'])
        self.assertEqual(created.processing_status, Session.STATUS_PROCESSING)
        self.assertEqual(created.processing_job_id, 'mc-job-123')
        enqueue_session_processing.assert_called_once()

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_MEDIA_CONVERT_ROLE_ARN='arn:aws:iam::123456789012:role/practica-mediaconvert',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='https://mediaconvert.us-east-1.amazonaws.com',
    )
    @patch('videos.services.media_pipeline._mediaconvert_client')
    def test_sync_mediaconvert_session_marks_session_ready_from_job_outputs(self, mediaconvert_client):
        session = self._create_session(user=self.owner)
        session.processing_status = Session.STATUS_PROCESSING
        session.processing_job_id = 'mc-job-123'
        session.video_file = 'sessions/uploaded.mov'
        session.save(update_fields=['processing_status', 'processing_job_id', 'video_file'])

        mediaconvert_client.return_value.get_job.return_value = {
            'Job': {
                'Status': 'COMPLETE',
                'OutputGroupDetails': [
                    {
                        'OutputDetails': [
                            {
                                'OutputFilePaths': [
                                    's3://test-bucket/processed/sessions/1/proxy/uploaded_proxy.mp4',
                                ],
                            },
                        ],
                    },
                ],
            },
        }

        sync_mediaconvert_session(session)

        session.refresh_from_db()
        self.assertEqual(session.processing_status, Session.STATUS_READY)
        self.assertEqual(session.processing_job_id, '')
        self.assertTrue(session.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4).exists())

    @override_settings(
        AWS_STORAGE_BUCKET_NAME='test-bucket',
        AWS_MEDIA_CONVERT_ROLE_ARN='arn:aws:iam::123456789012:role/practica-mediaconvert',
        AWS_MEDIA_CONVERT_ENDPOINT_URL='https://mediaconvert.us-east-1.amazonaws.com',
    )
    @patch('videos.services.media_pipeline._s3_client')
    @patch('videos.services.media_pipeline._mediaconvert_client')
    def test_sync_mediaconvert_session_discovers_proxy_asset_from_s3_prefix(self, mediaconvert_client, s3_client):
        session = self._create_session(user=self.owner)
        session.processing_status = Session.STATUS_PROCESSING
        session.processing_job_id = 'mc-job-456'
        session.video_file = 'sessions/uploaded.mp4'
        session.save(update_fields=['processing_status', 'processing_job_id', 'video_file'])

        mediaconvert_client.return_value.get_job.return_value = {
            'Job': {
                'Status': 'COMPLETE',
                'Settings': {
                    'OutputGroups': [
                        {
                            'Name': 'proxy-mp4',
                            'OutputGroupSettings': {
                                'Type': 'FILE_GROUP_SETTINGS',
                                'FileGroupSettings': {'Destination': 's3://test-bucket/processed/sessions/1/proxy/'},
                            },
                        },
                    ],
                },
                'OutputGroupDetails': [
                    {'OutputDetails': [{'DurationInMs': 2000}]},
                ],
            },
        }
        s3_client.return_value.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'processed/sessions/1/proxy/uploaded_proxy.mp4'},
            ],
        }

        sync_mediaconvert_session(session)

        session.refresh_from_db()
        self.assertEqual(session.processing_status, Session.STATUS_READY)
        self.assertTrue(session.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4, object_key='processed/sessions/1/proxy/uploaded_proxy.mp4').exists())

    @override_settings(AWS_STORAGE_BUCKET_NAME='test-bucket')
    def test_mediaconvert_job_settings_include_h264_max_bitrate(self):
        session = self._create_session(user=self.owner)
        session.video_file = 'sessions/uploaded.mp4'
        settings_payload = _create_job_settings(session)

        proxy_h264 = settings_payload['OutputGroups'][0]['Outputs'][0]['VideoDescription']['CodecSettings']['H264Settings']
        hls_h264 = settings_payload['OutputGroups'][1]['Outputs'][0]['VideoDescription']['CodecSettings']['H264Settings']

        self.assertEqual(proxy_h264['MaxBitrate'], 3000000)
        self.assertEqual(hls_h264['MaxBitrate'], 5000000)

    @override_settings(AWS_STORAGE_BUCKET_NAME='test-bucket')
    def test_mediaconvert_job_settings_route_audio_outputs_through_selector_group(self):
        session = self._create_session(user=self.owner)
        session.video_file = 'sessions/uploaded.mp4'

        settings_payload = _create_job_settings(session)

        input_settings = settings_payload['Inputs'][0]
        proxy_audio = settings_payload['OutputGroups'][0]['Outputs'][0]['AudioDescriptions'][0]
        hls_audio = settings_payload['OutputGroups'][1]['Outputs'][0]['AudioDescriptions'][0]

        self.assertEqual(input_settings['AudioSelectorGroups']['mixAll']['AudioSelectorNames'], ['A1', 'A2'])
        self.assertEqual(proxy_audio['AudioSourceName'], 'mixAll')
        self.assertEqual(hls_audio['AudioSourceName'], 'mixAll')
