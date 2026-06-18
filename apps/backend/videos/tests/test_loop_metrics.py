from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import ProductEventLog, Profile, Session
from videos.services.loop_metrics import build_loop_metrics


@patch('videos.library.api.start_processing_pipeline')
class LoopMetricsTests(APITestCase):
    def setUp(self):
        super().setUp()
        ProductEventLog.objects.all().delete()
        self.member = User.objects.create_user(username='loop_member', password='pass1234')
        Profile.objects.create(user=self.member, display_name='Loop Member')

    def _create_session(self, *, offset_days=0, hours=0, recorded_at=None):
        if recorded_at is None:
            recorded_at = timezone.now() - timedelta(days=offset_days, hours=hours)
        session = Session.objects.create(
            user=self.member,
            title=f'Proof {offset_days}-{hours}',
            description='',
            processing_status=Session.STATUS_READY,
        )
        Session.objects.filter(pk=session.pk).update(recorded_at=recorded_at)
        session.refresh_from_db()
        return session

    def _video_file(self, name='clip.mp4'):
        return SimpleUploadedFile(name, b'video-data', content_type='video/mp4')

    def test_proof_saved_event_on_create(self, pipeline_mock):
        self.client.force_authenticate(user=self.member)
        with patch('videos.library.api.attach_tags_to_session'):
            response = self.client.post(
                '/api/sessions/',
                {
                    'title': 'Loop metric proof',
                    'description': '',
                    'practice_series': '',
                    'video_file': self._video_file(),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        stored = ProductEventLog.objects.filter(event_name='proof_saved').get()
        self.assertEqual(stored.user_id, self.member.id)
        self.assertEqual(stored.extra_json.get('action'), 'proof_saved')
        self.assertEqual(stored.extra_json.get('session_id'), response.data['id'])

    def test_build_loop_metrics_counts_return_windows(self, pipeline_mock):
        base = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0)
        first = self._create_session(recorded_at=base - timedelta(days=20))
        self._create_session(recorded_at=base - timedelta(days=20) + timedelta(hours=6))
        self._create_session(recorded_at=base - timedelta(days=15))

        ProductEventLog.objects.create(
            event_name='proof_playback_started',
            user=self.member,
            is_authenticated=True,
            extra_json={'session_id': first.id, 'action': 'proof_playback_started'},
        )
        ProductEventLog.objects.create(
            event_name='today_viewed',
            user=self.member,
            is_authenticated=True,
            extra_json={'action': 'today_viewed'},
        )

        rows = build_loop_metrics(days=30, username='loop_member')
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['proof_count'], 3)
        self.assertEqual(row['unique_proof_days'], 2)
        self.assertTrue(row['returned_d1'])
        self.assertTrue(row['returned_d7'])
        self.assertEqual(row['playback_rate'], 33)
        self.assertGreaterEqual(row['today_views_last_7d'], 1)

    def test_loop_metrics_command_renders_table(self, pipeline_mock):
        self._create_session(offset_days=1)
        out = StringIO()
        call_command('loop_metrics', '--days', '7', stdout=out)
        output = out.getvalue()
        self.assertIn('Loop metrics', output)
        self.assertIn('Loop Member', output)

    def test_build_loop_metrics_respects_username_filter(self, pipeline_mock):
        other = User.objects.create_user(username='other_member', password='pass1234')
        Session.objects.create(
            user=other,
            title='Other proof',
            processing_status=Session.STATUS_READY,
        )
        self._create_session(offset_days=0)

        rows = build_loop_metrics(days=30, username='loop_member')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['username'], 'loop_member')
