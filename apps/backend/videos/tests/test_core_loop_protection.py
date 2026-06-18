from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, Session, SessionAsset


class CoreLoopProtectionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='proof-owner', password='pass1234')
        self.outsider = User.objects.create_user(username='proof-outsider', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Proof Owner')
        Profile.objects.create(user=self.outsider, display_name='Proof Outsider')

    def _create_session(self, *, title='Proof', processing_status=Session.STATUS_READY):
        return Session.objects.create(
            user=self.owner,
            title=title,
            video_file=SimpleUploadedFile('proof.mp4', b'video-data', content_type='video/mp4'),
            processing_status=processing_status,
        )

    def test_session_api_requires_authentication(self):
        session = self._create_session()

        list_response = self.client.get('/api/sessions/')
        detail_response = self.client.get(f'/api/sessions/{session.id}/')

        self.assertEqual(list_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(detail_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_outsider_cannot_read_or_mutate_another_members_proof(self):
        session = self._create_session()
        self.client.force_authenticate(user=self.outsider)

        responses = [
            self.client.get(f'/api/sessions/{session.id}/'),
            self.client.patch(f'/api/sessions/{session.id}/', {'title': 'Stolen'}, format='json'),
            self.client.delete(f'/api/sessions/{session.id}/'),
            self.client.post(f'/api/sessions/{session.id}/retry-processing/'),
            self.client.post(f'/api/sessions/{session.id}/share/'),
        ]

        self.assertTrue(all(response.status_code == status.HTTP_404_NOT_FOUND for response in responses))
        session.refresh_from_db()
        self.assertEqual(session.title, 'Proof')

    def test_owner_can_update_proof_without_changing_ownership(self):
        session = self._create_session()
        self.client.force_authenticate(user=self.owner)

        response = self.client.patch(
            f'/api/sessions/{session.id}/',
            {'title': 'Updated proof'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.title, 'Updated proof')
        self.assertEqual(session.user_id, self.owner.id)

    def test_proof_history_keeps_ready_processing_and_failed_uploads_visible(self):
        ready = self._create_session(title='Ready proof', processing_status=Session.STATUS_READY)
        processing = self._create_session(
            title='Processing proof',
            processing_status=Session.STATUS_PROCESSING,
        )
        failed = self._create_session(title='Failed proof', processing_status=Session.STATUS_FAILED)
        failed.processing_error = 'Playback conversion failed'
        failed.save(update_fields=['processing_error'])
        SessionAsset.objects.create(
            session=ready,
            asset_type=SessionAsset.TYPE_PROXY_MP4,
            object_key='processed/sessions/ready/proxy.mp4',
            content_type='video/mp4',
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.get('/api/sessions/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data if isinstance(response.data, list) else response.data['results']
        proofs_by_id = {proof['id']: proof for proof in payload}
        self.assertEqual(set(proofs_by_id), {ready.id, processing.id, failed.id})
        self.assertEqual(proofs_by_id[ready.id]['resolution']['code'], 'ready_for_review')
        self.assertEqual(proofs_by_id[processing.id]['resolution']['code'], 'processing')
        self.assertEqual(proofs_by_id[failed.id]['resolution']['code'], 'playback_failed')
        self.assertNotIn('video_file', proofs_by_id[ready.id])
        self.assertNotIn('assets', proofs_by_id[ready.id])
