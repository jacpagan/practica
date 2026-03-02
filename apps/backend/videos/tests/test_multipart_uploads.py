from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import MultipartSessionUpload, Profile, Session, Space, SpaceMember


class FakeS3Client:
    def __init__(self):
        self.parts_by_upload_id = {}

    def create_multipart_upload(self, **kwargs):
        self.created = kwargs
        return {'UploadId': 'upload-123'}

    def generate_presigned_url(self, ClientMethod, Params, ExpiresIn, HttpMethod):
        self.signed = {
            'ClientMethod': ClientMethod,
            'Params': Params,
            'ExpiresIn': ExpiresIn,
            'HttpMethod': HttpMethod,
        }
        return f"https://example.test/part/{Params['PartNumber']}"

    def complete_multipart_upload(self, **kwargs):
        self.completed = kwargs
        return {'Location': 'https://example.test/object'}

    def abort_multipart_upload(self, **kwargs):
        self.aborted = kwargs
        return {}

    def list_parts(self, **kwargs):
        upload_id = kwargs.get('UploadId')
        return {
            'Parts': self.parts_by_upload_id.get(upload_id, []),
            'IsTruncated': False,
        }


@override_settings(
    AWS_STORAGE_BUCKET_NAME='test-bucket',
    AWS_S3_REGION_NAME='us-east-1',
    UPLOAD_MAX_BYTES=2147483648,
)
class MultipartUploadApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass1234')
        self.member = User.objects.create_user(username='member', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Owner')
        Profile.objects.create(user=self.member, display_name='Member')
        self.space = Space.objects.create(name='Drumming', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)

    def test_multipart_create_session_flow(self):
        fake_s3 = FakeS3Client()
        self.client.force_authenticate(user=self.member)

        with patch('videos.views._s3_client', return_value=fake_s3):
            init_res = self.client.post(
                '/api/sessions/multipart/initiate/',
                {
                    'title': 'Big upload session',
                    'description': 'multipart path',
                    'size_bytes': 30 * 1024 * 1024,
                    'filename': 'drum-take.mp4',
                    'content_type': 'video/mp4',
                    'space': self.space.id,
                    'tags': ['timing', 'groove'],
                    'duration_seconds': 900,
                },
                format='json',
            )
            self.assertEqual(init_res.status_code, status.HTTP_201_CREATED)
            upload_id = init_res.data['multipart_upload_id']
            upload = MultipartSessionUpload.objects.get(pk=upload_id)
            self.assertGreater(upload.expires_at, timezone.now() + timedelta(hours=23))

            sign_res = self.client.post(
                '/api/sessions/multipart/sign-part/',
                {'multipart_upload_id': upload_id, 'part_number': 1},
                format='json',
            )
            self.assertEqual(sign_res.status_code, status.HTTP_200_OK)
            self.assertIn('signed_url', sign_res.data)

            complete_res = self.client.post(
                '/api/sessions/multipart/complete/',
                {
                    'multipart_upload_id': upload_id,
                    'parts': [{'part_number': 1, 'etag': '"etag-part-1"'}],
                },
                format='json',
            )
            self.assertEqual(complete_res.status_code, status.HTTP_201_CREATED)

        session = Session.objects.get(id=complete_res.data['id'])
        self.assertEqual(session.user, self.member)
        self.assertEqual(session.space, self.space)
        self.assertEqual(session.duration_seconds, 900)
        self.assertEqual(set(session.tags.values_list('name', flat=True)), {'timing', 'groove'})
        self.assertIn('sessions/', session.video_file.name)

    def test_user_cannot_sign_other_users_upload(self):
        fake_s3 = FakeS3Client()

        upload = MultipartSessionUpload.objects.create(
            user=self.owner,
            space=self.space,
            status=MultipartSessionUpload.STATUS_INITIATED,
            title='Owner Upload',
            description='',
            tags_csv='',
            duration_seconds=None,
            original_filename='owner.mp4',
            content_type='video/mp4',
            size_bytes=10 * 1024 * 1024,
            s3_key='sessions/owner/owner.mp4',
            s3_upload_id='upload-owner-1',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        self.client.force_authenticate(user=self.member)
        with patch('videos.views._s3_client', return_value=fake_s3):
            sign_res = self.client.post(
                '/api/sessions/multipart/sign-part/',
                {'multipart_upload_id': upload.id, 'part_number': 1},
                format='json',
            )
            self.assertEqual(sign_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_status_returns_uploaded_parts(self):
        fake_s3 = FakeS3Client()
        fake_s3.parts_by_upload_id['upload-status-1'] = [
            {'PartNumber': 1, 'ETag': '"etag-part-1"', 'Size': 5242880},
            {'PartNumber': 2, 'ETag': '"etag-part-2"', 'Size': 5242880},
        ]

        upload = MultipartSessionUpload.objects.create(
            user=self.member,
            space=self.space,
            status=MultipartSessionUpload.STATUS_INITIATED,
            title='Resume me',
            description='',
            tags_csv='',
            duration_seconds=None,
            original_filename='resume.mp4',
            content_type='video/mp4',
            size_bytes=20 * 1024 * 1024,
            s3_key='sessions/member/resume.mp4',
            s3_upload_id='upload-status-1',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        self.client.force_authenticate(user=self.member)
        with patch('videos.views._s3_client', return_value=fake_s3):
            status_res = self.client.post(
                '/api/sessions/multipart/status/',
                {'multipart_upload_id': upload.id},
                format='json',
            )
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(status_res.data['status'], MultipartSessionUpload.STATUS_INITIATED)
        self.assertEqual(status_res.data['part_size'], 5 * 1024 * 1024)
        self.assertEqual(status_res.data['total_parts'], 4)
        self.assertEqual(len(status_res.data['uploaded_parts']), 2)
        self.assertEqual(status_res.data['uploaded_parts'][0]['part_number'], 1)

    def test_status_marks_expired_upload(self):
        fake_s3 = FakeS3Client()
        upload = MultipartSessionUpload.objects.create(
            user=self.member,
            space=self.space,
            status=MultipartSessionUpload.STATUS_INITIATED,
            title='Old upload',
            description='',
            tags_csv='',
            duration_seconds=None,
            original_filename='old.mp4',
            content_type='video/mp4',
            size_bytes=10 * 1024 * 1024,
            s3_key='sessions/member/old.mp4',
            s3_upload_id='upload-old-1',
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        self.client.force_authenticate(user=self.member)
        with patch('videos.views._s3_client', return_value=fake_s3):
            status_res = self.client.post(
                '/api/sessions/multipart/status/',
                {'multipart_upload_id': upload.id},
                format='json',
            )
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(status_res.data['status'], MultipartSessionUpload.STATUS_EXPIRED)
