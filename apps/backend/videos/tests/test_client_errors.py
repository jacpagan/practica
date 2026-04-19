from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from videos.models import ProductEventLog


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
            extra_json={'upload_mode': 'single'},
        )

        self.client.force_authenticate(user=staff)
        response = self.client.get('/api/product-events/insights/?window_hours=48&limit=5')

        self.assertEqual(response.status_code, 200)
        summary = response.data['upload_summary']
        self.assertEqual(summary['total_upload_events'], 4)
        self.assertEqual(summary['upload_failed_count'], 2)
        self.assertEqual(summary['upload_aborted_count'], 1)
        self.assertEqual(summary['upload_succeeded_count'], 1)
        self.assertEqual(summary['top_failure_codes'][0]['code'], 'upload_finalize_failed')
        self.assertEqual(summary['top_failure_codes'][0]['count'], 2)
        self.assertEqual(summary['top_failure_statuses'][0]['status'], '502')
        self.assertEqual(summary['top_failure_statuses'][0]['count'], 2)
        self.assertEqual(summary['top_failure_phases'][0]['phase'], 'resuming')
        self.assertEqual(summary['top_failure_phases'][0]['count'], 2)
