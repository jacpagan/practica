from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Comment, Profile, Session, SessionAsset, Space, SpaceMember


@override_settings(AWS_STORAGE_BUCKET_NAME='')
class V1VideoFeaturesTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner-v1', password='pass1234')
        self.member = User.objects.create_user(username='member-v1', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Owner V1')
        Profile.objects.create(user=self.member, display_name='Member V1')
        self.space = Space.objects.create(name='V1 Space', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)

    def _video_file(self, name='clip.mp4'):
        return SimpleUploadedFile(name, b'video-data', content_type='video/mp4')

    def _create_session(self, user=None, space=None, title='Session 1'):
        return Session.objects.create(
            user=user or self.owner,
            space=space if space is not None else self.space,
            title=title,
            description='',
            video_file=self._video_file(),
            processing_status=Session.STATUS_READY,
        )

    def test_space_owner_can_set_main_session(self):
        session = self._create_session()
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            f'/api/spaces/{self.space.id}/set-main-session/',
            {'session_id': session.id},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.space.refresh_from_db()
        self.assertEqual(self.space.main_session_id, session.id)
        self.assertEqual(res.data['main_session_id'], session.id)

    def test_non_owner_cannot_set_main_session(self):
        session = self._create_session()
        self.client.force_authenticate(user=self.member)

        res = self.client.post(
            f'/api/spaces/{self.space.id}/set-main-session/',
            {'session_id': session.id},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_main_session_must_belong_to_space(self):
        other_space = Space.objects.create(name='Other Space', owner=self.owner)
        other_session = self._create_session(space=other_space, title='Other')
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            f'/api/spaces/{self.space.id}/set-main-session/',
            {'session_id': other_session.id},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_comment_requires_video_reply(self):
        session = self._create_session(user=self.member)
        self.client.force_authenticate(user=self.owner)

        no_video = self.client.post(
            f'/api/sessions/{session.id}/add_comment/',
            {'text': 'text-only'},
            format='multipart',
        )
        self.assertEqual(no_video.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('required', no_video.data['error'].lower())

        with_video = self.client.post(
            f'/api/sessions/{session.id}/add_comment/',
            {'text': '', 'video_reply': self._video_file('reply.mp4')},
            format='multipart',
        )
        self.assertEqual(with_video.status_code, status.HTTP_201_CREATED)
        comment = Comment.objects.latest('id')
        self.assertEqual(comment.text, '')
        self.assertFalse(comment.legacy_text_only)
        self.assertTrue(bool(comment.video_reply))

    def test_legacy_text_only_comment_remains_visible(self):
        session = self._create_session()
        legacy = Comment.objects.create(
            session=session,
            user=self.owner,
            text='Legacy',
            video_reply='',
            legacy_text_only=True,
        )
        self.client.force_authenticate(user=self.owner)

        detail = self.client.get(f'/api/sessions/{session.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertTrue(any(c['id'] == legacy.id for c in detail.data['comments']))

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
                'space': self.space.id,
                'video_file': self._video_file('uploaded.mp4'),
            },
            format='multipart',
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Session.objects.get(id=res.data['id'])
        self.assertEqual(created.processing_status, Session.STATUS_READY)
        self.assertTrue(created.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4).exists())

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
                {
                    'asset_type': 'thumb_vtt',
                    'object_key': 'processed/sessions/1/thumbs/thumbs.vtt',
                    'content_type': 'text/vtt',
                    'metadata_json': {},
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
        self.assertEqual(session.assets.count(), 2)

    @override_settings(MEDIA_PROCESSING_CALLBACK_TOKEN='callback-secret')
    def test_processing_update_requires_auth_token_or_staff(self):
        session = self._create_session()
        session.processing_status = Session.STATUS_PROCESSING
        session.save(update_fields=['processing_status'])

        res = self.client.post(
            f'/api/sessions/{session.id}/processing-update/',
            {'status': 'failed', 'processing_error': 'boom'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
