from unittest.mock import patch

from rest_framework.test import APITestCase


class ClientErrorTelemetryTests(APITestCase):
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

