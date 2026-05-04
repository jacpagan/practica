from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import MLDatasetSnapshot, MLModelSuggestion, ReviewRequest, Session, Tag, VideoFeedback


class MLTrainingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='ml-owner', password='pass1234')
        self.reviewer = User.objects.create_user(username='ml-reviewer', password='pass1234')
        self.staff = User.objects.create_user(username='ml-staff', password='pass1234', is_staff=True)

    def _create_session(self, *, user=None, title='Session', practice_series=''):
        return Session.objects.create(
            user=user or self.owner,
            title=title,
            practice_series=practice_series,
            description='',
            video_file='sessions/test.mp4',
            processing_status=Session.STATUS_READY,
        )

    def test_owner_can_enable_and_revoke_ml_training_consent(self):
        session = self._create_session(practice_series='Drum Thread')
        self.client.force_authenticate(user=self.owner)

        enable_response = self.client.post(
            f'/api/sessions/{session.id}/ml-consent/',
            {'enabled': True, 'source': 'owner_settings'},
            format='json',
        )
        self.assertEqual(enable_response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertTrue(session.ml_training_enabled)
        self.assertEqual(session.ml_training_consent_source, 'owner_settings')
        self.assertIsNotNone(session.ml_training_consent_at)
        self.assertIsNone(session.ml_training_consent_revoked_at)

        revoke_response = self.client.delete(
            f'/api/sessions/{session.id}/ml-consent/',
            {'source': 'owner_settings'},
            format='json',
        )
        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertFalse(session.ml_training_enabled)
        self.assertIsNotNone(session.ml_training_consent_revoked_at)
        self.assertEqual(session.ml_training_consent_revocation_source, 'owner_settings')

    def test_training_export_includes_only_opted_in_sessions_and_label_signals(self):
        consented = self._create_session(title='Ghost notes groove', practice_series='Drum Thread')
        ignored = self._create_session(title='Piano warmup', practice_series='Piano Thread')
        tag = Tag.objects.create(name='drums')
        consented.tags.add(tag)

        review_request = ReviewRequest.objects.create(
            session=consented,
            student=self.owner,
            reviewer=self.reviewer,
            instrument='drums',
            goal='Improve timing',
            exercise_or_song='Ghost note groove',
            notes='Focus on the backbeat.',
            status=ReviewRequest.STATUS_RESPONDED,
        )
        VideoFeedback.objects.create(
            session=consented,
            review_request=review_request,
            user=self.reviewer,
            feedback_category='timing',
            text='Keep the pulse steady.',
            feedback_video='feedback_videos/reply.mp4',
            is_legacy_text_feedback=False,
        )

        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f'/api/sessions/{consented.id}/ml-consent/',
            {'enabled': True, 'source': 'owner_settings'},
            format='json',
        )

        self.client.force_authenticate(user=self.staff)
        response = self.client.get('/api/sessions/ml/training-export/?limit=25')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['snapshot_version'], 'ml-training-export-v1')
        self.assertEqual(response.data['row_count'], 1)
        self.assertEqual(len(response.data['rows']), 1)
        self.assertEqual(response.data['rows'][0]['session_id'], consented.id)
        self.assertEqual(response.data['rows'][0]['practice_series'], 'Drum Thread')
        self.assertEqual(response.data['rows'][0]['thread_label'], 'Drum Thread')
        self.assertEqual(response.data['rows'][0]['feedback_category_counts'], {'timing': 1})
        self.assertIn('drums', response.data['rows'][0]['secondary_labels'])
        self.assertEqual(MLDatasetSnapshot.objects.count(), 1)

        self.client.force_authenticate(user=self.owner)
        forbidden = self.client.get('/api/sessions/ml/training-export/')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(any(row['session_id'] == ignored.id for row in response.data['rows']))

    def test_ml_suggestions_return_a_thread_prediction_and_store_feedback(self):
        training = self._create_session(title='Ghost notes groove', practice_series='Drum Thread')
        target = self._create_session(title='Ghost notes practice', practice_series='')
        training.tags.add(Tag.objects.create(name='drums'))

        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f'/api/sessions/{training.id}/ml-consent/',
            {'enabled': True, 'source': 'owner_settings'},
            format='json',
        )

        suggestion_response = self.client.get(f'/api/sessions/{target.id}/ml-suggestions/')
        self.assertEqual(suggestion_response.status_code, status.HTTP_200_OK)
        self.assertEqual(suggestion_response.data['thread']['label'], 'Drum Thread')
        self.assertGreaterEqual(suggestion_response.data['thread']['confidence'], 0)
        self.assertTrue(suggestion_response.data['matched_sessions'])

        feedback_response = self.client.post(
            f'/api/sessions/{target.id}/ml-suggestions/',
            {
                'decision': 'accepted',
                'resolved_thread_label': 'Drum Thread',
                'resolved_label_choices': ['drums'],
                'note': 'Looks right.',
            },
            format='json',
        )

        self.assertEqual(feedback_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MLModelSuggestion.objects.count(), 1)
        record = MLModelSuggestion.objects.get()
        self.assertEqual(record.session, target)
        self.assertEqual(record.model_name, 'baseline-session-thread-suggester')
        self.assertEqual(record.decision, 'accepted')
        self.assertEqual(record.resolved_thread_label, 'Drum Thread')

    def test_ml_suggestions_require_session_access(self):
        target = self._create_session(title='Private session', practice_series='')
        outsider = User.objects.create_user(username='ml-outsider', password='pass1234')
        self.client.force_authenticate(user=outsider)

        response = self.client.get(f'/api/sessions/{target.id}/ml-suggestions/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
