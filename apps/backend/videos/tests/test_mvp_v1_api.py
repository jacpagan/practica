from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewFeedback, ReviewLink, Session


class FakeS3Client:
    def create_multipart_upload(self, **kwargs):
        return {'UploadId': 'upload-v1-123'}

    def generate_presigned_url(self, ClientMethod, Params, ExpiresIn, HttpMethod):
        return f"https://example.test/parts/{Params['PartNumber']}"

    def complete_multipart_upload(self, **kwargs):
        return {'Location': 'https://example.test/object'}

    def abort_multipart_upload(self, **kwargs):
        return {}

    def list_parts(self, **kwargs):
        return {'Parts': [], 'IsTruncated': False}


@override_settings(
    AWS_STORAGE_BUCKET_NAME='test-bucket',
    AWS_S3_REGION_NAME='us-east-1',
    AWS_S3_ENDPOINT_URL='http://minio:9000',
    AWS_S3_ADDRESSING_STYLE='path',
)
class MvpV1ApiTests(APITestCase):
    def test_register_login_session_review_feedback_flow(self):
        register = self.client.post(
            '/api/v1/auth/register',
            {'email': 'student@example.com', 'password': 'student123', 'display_name': 'Student', 'role': 'student'},
            format='json',
        )
        self.assertEqual(register.status_code, status.HTTP_201_CREATED)
        student_token = register.data['token']

        coach = User.objects.create_user(username='coach1', email='coach@example.com', password='coach123')
        Profile.objects.create(user=coach, display_name='Coach', role=Profile.ROLE_COACH)
        self.client.force_authenticate(user=coach)

        student = User.objects.get(email='student@example.com')
        session = Session.objects.create(
            user=student,
            title='Session A',
            description='',
            video_file='sessions/student-a.mp4',
            status=Session.STATUS_READY,
            processing_status=Session.STATUS_READY,
        )

        comment_res = self.client.post(
            f'/api/v1/sessions/{session.id}/comments',
            {'body': 'Watch your timing at 0:45', 'timestamp_seconds': 45},
            format='json',
        )
        self.assertEqual(comment_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(comment_res.data['timestamp_seconds'], 45)
        self.client.force_authenticate(user=None)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {student_token}')
        link_res = self.client.post(
            f'/api/v1/sessions/{session.id}/review-links',
            {'allow_comments': True, 'pin_code': '4321'},
            format='json',
        )
        self.assertEqual(link_res.status_code, status.HTTP_201_CREATED)
        token = link_res.data['token']

        verify_bad = self.client.post(f'/api/v1/review-links/{token}/verify-pin', {'pin_code': '0000'}, format='json')
        self.assertEqual(verify_bad.status_code, status.HTTP_200_OK)
        self.assertFalse(verify_bad.data['ok'])

        verify_ok = self.client.post(f'/api/v1/review-links/{token}/verify-pin', {'pin_code': '4321'}, format='json')
        self.assertEqual(verify_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_ok.data['ok'])

        public_feedback = self.client.post(
            f'/api/v1/review-links/{token}/feedback',
            {'pin_code': '4321', 'name': 'Guest', 'text': 'Great work', 'timestamp_seconds': 50},
            format='json',
        )
        self.assertEqual(public_feedback.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ReviewFeedback.objects.filter(review_link__token=token).exists())

        revoke = self.client.post(f"/api/v1/review-links/{link_res.data['id']}/revoke", format='json')
        self.assertEqual(revoke.status_code, status.HTTP_200_OK)
        self.assertFalse(ReviewLink.objects.get(pk=link_res.data['id']).is_active)

    def test_direct_upload_request_and_complete(self):
        user = User.objects.create_user(username='u1', email='u1@example.com', password='pass1234')
        Profile.objects.create(user=user, display_name='U1', role=Profile.ROLE_STUDENT)
        self.client.force_authenticate(user=user)
        fake_s3 = FakeS3Client()

        create_session = self.client.post(
            '/api/v1/sessions',
            {'title': 'Upload session', 'description': 'desc'},
            format='json',
        )
        self.assertEqual(create_session.status_code, status.HTTP_201_CREATED)
        session_id = create_session.data['id']

        with patch('videos.v1_views._s3_client', return_value=fake_s3), patch('videos.v1_views.process_uploaded_session.delay'):
            req = self.client.post(
                '/api/v1/uploads/request',
                {
                    'filename': 'clip.mp4',
                    'content_type': 'video/mp4',
                    'size_bytes': 10 * 1024 * 1024,
                    'session_id': session_id,
                },
                format='json',
            )
            self.assertEqual(req.status_code, status.HTTP_201_CREATED)
            upload_id = req.data['upload_id']

            sign = self.client.post(f'/api/v1/uploads/{upload_id}/sign-part', {'part_number': 1}, format='json')
            self.assertEqual(sign.status_code, status.HTTP_200_OK)
            self.assertIn('signed_url', sign.data)

            complete = self.client.post(
                f'/api/v1/uploads/{upload_id}/complete',
                {'parts': [{'part_number': 1, 'etag': '"etag-1"'}]},
                format='json',
            )
            self.assertEqual(complete.status_code, status.HTTP_200_OK)
            self.assertEqual(complete.data['session']['status'], Session.STATUS_UPLOADED)
