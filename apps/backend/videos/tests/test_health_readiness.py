from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import override_settings
from rest_framework.test import APITestCase


class HealthReadinessTests(APITestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['services']['database'], 'healthy')

    def test_ready_endpoint_requires_frontend_bundle(self):
        with TemporaryDirectory() as tmpdir:
            response = self.client.get('/ready/')
            self.assertIn(response.status_code, {200, 503})

            missing_bundle_response = None
            with override_settings(FRONTEND_DIR=Path(tmpdir)):
                missing_bundle_response = self.client.get('/ready/')

            self.assertIsNotNone(missing_bundle_response)
            self.assertEqual(missing_bundle_response.status_code, 503)
            self.assertEqual(missing_bundle_response.data['status'], 'not_ready')
            self.assertEqual(missing_bundle_response.data['checks']['database'], 'ready')
            self.assertEqual(missing_bundle_response.data['checks']['frontend_bundle'], 'missing')

    def test_ready_endpoint_returns_ok_when_bundle_exists(self):
        with TemporaryDirectory() as tmpdir:
            Path(tmpdir, 'index.html').write_text('<!doctype html>', encoding='utf-8')

            with override_settings(FRONTEND_DIR=Path(tmpdir)):
                response = self.client.get('/ready/')

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['status'], 'ready')
            self.assertEqual(response.data['checks']['database'], 'ready')
            self.assertEqual(response.data['checks']['frontend_bundle'], 'ready')
