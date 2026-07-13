from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from videos.models import ProductEventLog, Session


class ClientErrorTelemetryTests(APITestCase):
    def setUp(self):
        super().setUp()
        ProductEventLog.objects.all().delete()

    @patch('videos.views.logger')
    def test_product_event_logs_normalized_payload(self, logger_mock):
        response = self.client.post(
            '/api/client-errors/',
            {
                'source': 'ProductEvent',
                'message': 'reviewer_invite_claim_failed',
                'path': '/api/review/abc123/?claim=XYZ',
                'extra': {
                    'reason': 'x' * 300,
                    'session_id': 44,
                    'action': 'ask_for_feedback',
                    'review_token_present': True,
                    'ignore_me': 'should_not_be_logged',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, 202)
        logger_mock.info.assert_called_once()
        logger_mock.warning.assert_not_called()

        logged_extra = logger_mock.info.call_args.args[-1]
        self.assertEqual(logged_extra['session_id'], 44)
        self.assertEqual(logged_extra['action'], 'ask_for_feedback')
        self.assertEqual(logged_extra['review_token_present'], True)
        self.assertNotIn('ignore_me', logged_extra)
        self.assertLessEqual(len(logged_extra['reason']), 160)
        stored = ProductEventLog.objects.get()
        self.assertEqual(stored.event_name, 'reviewer_invite_claim_failed')
        self.assertEqual(stored.path, '/api/review/:token/')
        self.assertEqual(stored.extra_json.get('action'), 'ask_for_feedback')

    @patch('videos.views.logger')
    def test_product_event_logs_upload_fields(self, logger_mock):
        response = self.client.post(
            '/api/client-errors/',
            {
                'source': 'ProductEvent',
                'message': 'session_upload_failed',
                'path': '/upload',
                'extra': {
                    'action': 'session_upload_failed',
                    'upload_mode': 'multipart',
                    'file_size_bytes': 9437184,
                    'code': 'upload_finalize_failed',
                    'phase': 'resuming',
                    'status': 502,
                    'duration_ms': 1200,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, 202)
        stored = ProductEventLog.objects.get()
        self.assertEqual(stored.event_name, 'session_upload_failed')
        self.assertEqual(stored.extra_json.get('upload_mode'), 'multipart')
        self.assertEqual(stored.extra_json.get('file_size_bytes'), 9437184)
        self.assertEqual(stored.extra_json.get('code'), 'upload_finalize_failed')
        self.assertEqual(stored.extra_json.get('phase'), 'resuming')
        self.assertEqual(stored.extra_json.get('status'), 502)
        self.assertEqual(stored.extra_json.get('duration_ms'), 1200)

    @patch('videos.views.logger')
    def test_non_product_event_uses_legacy_client_error_log(self, logger_mock):
        response = self.client.post(
            '/api/client-errors/',
            {
                'source': 'UnhandledRejection',
                'message': 'something failed',
                'path': '/sessions/77',
                'extra': {'session_id': 77},
            },
            format='json',
        )

        self.assertEqual(response.status_code, 202)
        logger_mock.warning.assert_called_once()
        logger_mock.info.assert_not_called()

    def test_product_event_insights_requires_staff(self):
        user = User.objects.create_user(username='member', password='test-pass')
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/product-events/insights/')
        self.assertEqual(response.status_code, 403)

    def test_product_event_insights_returns_aggregates_for_staff(self):
        staff = User.objects.create_user(username='admin', password='test-pass', is_staff=True)
        ProductEventLog.objects.create(event_name='reviewer_inbox_filter_changed', path='/requests', is_authenticated=False)
        ProductEventLog.objects.create(event_name='reviewer_inbox_filter_changed', path='/requests', is_authenticated=False)
        ProductEventLog.objects.create(event_name='reviewer_quick_action_selected', path='/r/:token', is_authenticated=False)

        self.client.force_authenticate(user=staff)
        response = self.client.get('/api/product-events/insights/?window_hours=48&limit=5')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_events'], 3)
        self.assertEqual(response.data['top_events'][0]['event_name'], 'reviewer_inbox_filter_changed')
        self.assertEqual(response.data['top_events'][0]['count'], 2)
        self.assertEqual(response.data['top_paths'][0]['path'], '/requests')
        self.assertEqual(response.data['top_paths'][0]['count'], 2)
        self.assertIn('upload_summary', response.data)

    def test_product_event_insights_includes_upload_failure_buckets(self):
        staff = User.objects.create_user(username='admin-upload', password='test-pass', is_staff=True)
        ProductEventLog.objects.create(
            event_name='session_upload_failed',
            path='/upload',
            is_authenticated=True,
            extra_json={'code': 'upload_finalize_failed', 'status': 502, 'phase': 'resuming', 'upload_mode': 'multipart'},
        )
        ProductEventLog.objects.create(
            event_name='session_upload_failed',
            path='/upload',
            is_authenticated=True,
            extra_json={'code': 'upload_finalize_failed', 'status': 502, 'phase': 'resuming', 'upload_mode': 'multipart'},
        )
        ProductEventLog.objects.create(
            event_name='session_upload_aborted',
            path='/upload',
            is_authenticated=True,
            extra_json={'upload_mode': 'single'},
        )
        ProductEventLog.objects.create(
            event_name='session_upload_succeeded',
            path='/upload',
            is_authenticated=True,
            extra_json={'upload_mode': 'single', 'duration_ms': 1200},
        )
        ProductEventLog.objects.create(
            event_name='session_upload_paused',
            path='/upload',
            is_authenticated=True,
            extra_json={'upload_mode': 'multipart'},
        )

        self.client.force_authenticate(user=staff)
        response = self.client.get('/api/product-events/insights/?window_hours=48&limit=5')

        self.assertEqual(response.status_code, 200)
        summary = response.data['upload_summary']
        self.assertEqual(summary['total_upload_events'], 5)
        self.assertEqual(summary['upload_failed_count'], 2)
        self.assertEqual(summary['upload_aborted_count'], 1)
        self.assertEqual(summary['upload_succeeded_count'], 1)
        self.assertEqual(summary['upload_paused_count'], 1)
        self.assertEqual(summary['avg_success_duration_ms'], 1200)
        self.assertEqual(summary['top_failure_codes'][0]['code'], 'upload_finalize_failed')
        self.assertEqual(summary['top_failure_codes'][0]['count'], 2)
        self.assertEqual(summary['top_failure_statuses'][0]['status'], '502')
        self.assertEqual(summary['top_failure_statuses'][0]['count'], 2)
        self.assertEqual(summary['top_failure_phases'][0]['phase'], 'resuming')
        self.assertEqual(summary['top_failure_phases'][0]['count'], 2)

    def test_internal_metrics_requires_staff(self):
        user = User.objects.create_user(username='metrics-member', password='test-pass')
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/internal/metrics/')

        self.assertEqual(response.status_code, 403)

    def test_internal_metrics_returns_core_loop_counts_for_staff(self):
        staff = User.objects.create_user(username='metrics-admin', password='test-pass', is_staff=True)
        member = User.objects.create_user(username='metrics-member', password='test-pass')
        first_at = timezone.now() - timedelta(days=5)
        second_at = first_at + timedelta(hours=6)
        first = Session.objects.create(
            user=member,
            title='First proof',
            practice_series='Pushups',
            processing_status=Session.STATUS_READY,
        )
        second = Session.objects.create(
            user=member,
            title='Second proof',
            practice_series='Pushups',
            processing_status=Session.STATUS_READY,
        )
        Session.objects.filter(pk=first.pk).update(recorded_at=first_at)
        Session.objects.filter(pk=second.pk).update(recorded_at=second_at)
        ProductEventLog.objects.create(
            event_name='session_upload_succeeded',
            user=member,
            is_authenticated=True,
            extra_json={'file_size_bytes': 1000, 'duration_ms': 500, 'upload_mode': 'single'},
        )
        ProductEventLog.objects.create(
            event_name='session_upload_failed',
            user=member,
            is_authenticated=True,
            extra_json={'code': 'network_error', 'upload_mode': 'single'},
        )

        self.client.force_authenticate(user=staff)
        response = self.client.get('/api/internal/metrics/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['people']['total_users'], 2)
        self.assertEqual(response.data['people']['users_with_proofs'], 1)
        self.assertEqual(response.data['proofs']['total'], 2)
        self.assertEqual(response.data['proofs']['ready'], 2)
        self.assertEqual(response.data['uploads_30d']['succeeded'], 1)
        self.assertEqual(response.data['uploads_30d']['failed'], 1)
        self.assertEqual(response.data['uploads_30d']['success_file_bytes'], 1000)
        self.assertEqual(response.data['smart']['activation']['activated_users'], 1)
        self.assertEqual(response.data['smart']['activation']['zero_proof_users'], 1)
        self.assertEqual(response.data['smart']['repeat']['repeat_users'], 1)
        self.assertEqual(response.data['smart']['frequency']['proofs_30d'], 2)
        self.assertEqual(response.data['people']['repeat_users'], 1)
        self.assertEqual(response.data['users'][0]['username'], 'metrics-member')
        self.assertEqual(response.data['users'][0]['status'], 'repeat')
        self.assertEqual(response.data['users'][0]['proof_count'], 2)
        self.assertEqual(response.data['users'][0]['primary_skill'], 'Pushups')
        self.assertEqual(response.data['cohorts'][0]['users'], 2)
        self.assertEqual(response.data['retention']['repeat_within_1d'], 1)
        self.assertEqual(response.data['skills']['top'][0]['practice_series'], 'Pushups')
        self.assertEqual(response.data['skills']['top'][0]['count'], 2)
        self.assertEqual(response.data['skills']['top'][0]['user_count'], 1)
