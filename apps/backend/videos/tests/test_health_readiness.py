from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase


class HealthReadinessTests(APITestCase):
    def test_health_endpoint_returns_ok(self):
        response = self.client.get('/health/')
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['status'], 'healthy')
        self.assertEqual(payload['services']['database'], 'healthy')

    @patch('videos.views.media_pipeline_enabled', return_value=False)
    @patch('videos.views.local_transcode_enabled', return_value=True)
    def test_health_endpoint_reports_video_processing_capabilities(self, local_transcode_enabled, media_pipeline_enabled):
        response = self.client.get('/health/')
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['video_processing']['local_ffmpeg'], True)
        self.assertEqual(payload['video_processing']['mediaconvert'], False)
        local_transcode_enabled.assert_called_once()
        media_pipeline_enabled.assert_called_once()

    def test_ready_endpoint_requires_frontend_bundle(self):
        with TemporaryDirectory() as tmpdir:
            response = self.client.get('/ready/')
            self.assertIn(response.status_code, {200, 503})

            missing_bundle_response = None
            with override_settings(FRONTEND_DIR=Path(tmpdir)):
                missing_bundle_response = self.client.get('/ready/')
                missing_payload = missing_bundle_response.json()

            self.assertIsNotNone(missing_bundle_response)
            self.assertEqual(missing_bundle_response.status_code, 503)
            self.assertEqual(missing_payload['status'], 'not_ready')
            self.assertEqual(missing_payload['checks']['database'], 'ready')
            self.assertEqual(missing_payload['checks']['frontend_bundle'], 'missing')

    def test_ready_endpoint_returns_ok_when_bundle_exists(self):
        with TemporaryDirectory() as tmpdir:
            Path(tmpdir, 'index.html').write_text('<!doctype html>', encoding='utf-8')

            with override_settings(FRONTEND_DIR=Path(tmpdir)):
                response = self.client.get('/ready/')
                payload = response.json()

            self.assertEqual(response.status_code, 200)
            self.assertEqual(payload['status'], 'ready')
            self.assertEqual(payload['checks']['database'], 'ready')
            self.assertEqual(payload['checks']['frontend_bundle'], 'ready')
