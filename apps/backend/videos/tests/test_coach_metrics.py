from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import (
    CoachDailyMetric,
    CoachEvent,
    FeedbackAssignment,
    FeedbackRequest,
    Profile,
    Session,
    Space,
    SpaceMember,
)
from videos.services.coach_metrics import compute_daily_metric_for_coach


class CoachMetricModelTests(TestCase):
    def setUp(self):
        self.coach = User.objects.create_user(username='coach-model', password='pass1234')

    def test_daily_metric_unique_constraint(self):
        metric_date = timezone.now().date()
        CoachDailyMetric.objects.create(coach=self.coach, date=metric_date)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CoachDailyMetric.objects.create(coach=self.coach, date=metric_date)

    def test_expected_indexes_declared(self):
        coach_event_index_fields = [idx.fields for idx in CoachEvent._meta.indexes]
        coach_daily_metric_index_fields = [idx.fields for idx in CoachDailyMetric._meta.indexes]
        self.assertIn(['user', 'event_type', 'occurred_at'], coach_event_index_fields)
        self.assertIn(['coach', 'date'], coach_daily_metric_index_fields)


@override_settings(FEEDBACK_REQUESTS_ENABLED=True, COACH_METRICS_ENABLED=True)
class CoachMetricsEventCaptureTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner-events', password='pass1234')
        self.member = User.objects.create_user(username='member-events', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Owner')
        Profile.objects.create(user=self.member, display_name='Member')
        self.space = Space.objects.create(name='Drumming Events', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)
        self.owner_session = Session.objects.create(
            user=self.owner,
            space=self.space,
            title='Owner Session',
            description='Seed',
            video_file=self._video_file('seed.mp4'),
        )

    def _video_file(self, name='clip.mp4'):
        return SimpleUploadedFile(name, b'video-data', content_type='video/mp4')

    def test_session_upload_emits_event(self):
        self.client.force_authenticate(user=self.member)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/api/sessions/',
                {
                    'title': 'New Session',
                    'description': 'Upload from member',
                    'video_file': self._video_file('member.mp4'),
                    'space': self.space.id,
                },
                format='multipart',
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        events = CoachEvent.objects.filter(user=self.member, event_type=CoachEvent.EVENT_SESSION_UPLOADED)
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().space_id, self.space.id)

    def test_claim_retry_does_not_duplicate_and_complete_emits_events(self):
        self.client.force_authenticate(user=self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            req_response = self.client.post(
                f'/api/sessions/{self.owner_session.id}/feedback-request/',
                {'focus_prompt': 'Please review groove', 'sla_hours': 48},
                format='json',
            )
        self.assertEqual(req_response.status_code, status.HTTP_201_CREATED)
        request_id = req_response.data['id']
        self.assertEqual(
            CoachEvent.objects.filter(
                user=self.owner,
                event_type=CoachEvent.EVENT_FEEDBACK_REQUESTED,
                feedback_request_id=request_id,
            ).count(),
            1,
        )

        self.client.force_authenticate(user=self.member)
        with self.captureOnCommitCallbacks(execute=True):
            claim_one = self.client.post(f'/api/feedback-requests/{request_id}/claim/')
        claim_two = self.client.post(f'/api/feedback-requests/{request_id}/claim/')
        self.assertEqual(claim_one.status_code, status.HTTP_201_CREATED)
        self.assertEqual(claim_two.status_code, status.HTTP_200_OK)
        self.assertEqual(
            CoachEvent.objects.filter(
                user=self.member,
                event_type=CoachEvent.EVENT_FEEDBACK_CLAIMED,
                feedback_request_id=request_id,
            ).count(),
            1,
        )

        with self.captureOnCommitCallbacks(execute=True):
            complete_response = self.client.post(
                f'/api/feedback-requests/{request_id}/complete/',
                {'text': 'Good time feel', 'video_reply': self._video_file('reply.mp4')},
                format='multipart',
            )
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            CoachEvent.objects.filter(
                user=self.member,
                event_type=CoachEvent.EVENT_FEEDBACK_COMPLETED,
                feedback_request_id=request_id,
            ).count(),
            1,
        )
        self.assertEqual(
            CoachEvent.objects.filter(
                user=self.member,
                event_type=CoachEvent.EVENT_VIDEO_FEEDBACK_COMPLETED,
                feedback_request_id=request_id,
            ).count(),
            1,
        )


class CoachMetricsAggregationTests(TestCase):
    def setUp(self):
        self.coach = User.objects.create_user(username='coach-agg', password='pass1234')
        self.student_a = User.objects.create_user(username='student-a', password='pass1234')
        self.student_b = User.objects.create_user(username='student-b', password='pass1234')
        self.other_user = User.objects.create_user(username='other-user', password='pass1234')

        self.space = Space.objects.create(name='Drumming Agg', owner=self.coach)
        SpaceMember.objects.create(space=self.space, user=self.student_a)
        SpaceMember.objects.create(space=self.space, user=self.student_b)

        self.anchor = timezone.now().date()
        self._seed_sessions()
        self._seed_feedback_requests()

    def _video_file(self, name):
        return SimpleUploadedFile(name, b'video-data', content_type='video/mp4')

    def _seed_sessions(self):
        in_window_time = timezone.now() - timedelta(days=3)
        old_time = timezone.now() - timedelta(days=40)

        session_a = Session.objects.create(
            user=self.student_a,
            space=self.space,
            title='Student A',
            description='',
            video_file=self._video_file('a.mp4'),
        )
        Session.objects.filter(pk=session_a.pk).update(created_at=in_window_time, recorded_at=in_window_time)

        session_b = Session.objects.create(
            user=self.student_b,
            space=self.space,
            title='Student B',
            description='',
            video_file=self._video_file('b.mp4'),
        )
        Session.objects.filter(pk=session_b.pk).update(created_at=in_window_time, recorded_at=in_window_time)

        old_session = Session.objects.create(
            user=self.other_user,
            space=self.space,
            title='Old Outside Window',
            description='',
            video_file=self._video_file('old.mp4'),
        )
        Session.objects.filter(pk=old_session.pk).update(created_at=old_time, recorded_at=old_time)

        self.feedback_session = session_a

    def _seed_feedback_requests(self):
        request_one_created = timezone.now() - timedelta(days=4)
        request_two_created = timezone.now() - timedelta(days=25)
        request_old_created = timezone.now() - timedelta(days=45)

        fr_one = FeedbackRequest.objects.create(
            session=self.feedback_session,
            requester=self.student_a,
            space=self.space,
            status=FeedbackRequest.STATUS_OPEN,
            sla_hours=48,
            due_at=timezone.now() + timedelta(days=1),
            required_reviews=1,
            video_required_count=0,
            focus_prompt='Request one',
        )
        FeedbackRequest.objects.filter(pk=fr_one.pk).update(created_at=request_one_created)
        FeedbackAssignment.objects.create(
            feedback_request=fr_one,
            reviewer=self.coach,
            status=FeedbackAssignment.STATUS_COMPLETED,
            completed_at=request_one_created + timedelta(hours=24),
            is_video_review=False,
        )

        fr_two = FeedbackRequest.objects.create(
            session=self.feedback_session,
            requester=self.student_b,
            space=self.space,
            status=FeedbackRequest.STATUS_OPEN,
            sla_hours=48,
            due_at=timezone.now() + timedelta(days=1),
            required_reviews=1,
            video_required_count=0,
            focus_prompt='Request two',
        )
        FeedbackRequest.objects.filter(pk=fr_two.pk).update(created_at=request_two_created)
        FeedbackAssignment.objects.create(
            feedback_request=fr_two,
            reviewer=self.coach,
            status=FeedbackAssignment.STATUS_COMPLETED,
            completed_at=request_two_created + timedelta(hours=48),
            is_video_review=True,
        )

        fr_old = FeedbackRequest.objects.create(
            session=self.feedback_session,
            requester=self.student_b,
            space=self.space,
            status=FeedbackRequest.STATUS_OPEN,
            sla_hours=48,
            due_at=timezone.now() + timedelta(days=1),
            required_reviews=1,
            video_required_count=0,
            focus_prompt='Old request',
        )
        FeedbackRequest.objects.filter(pk=fr_old.pk).update(created_at=request_old_created)
        FeedbackAssignment.objects.create(
            feedback_request=fr_old,
            reviewer=self.coach,
            status=FeedbackAssignment.STATUS_COMPLETED,
            completed_at=request_old_created + timedelta(hours=12),
            is_video_review=False,
        )

    def test_compute_daily_metric_values(self):
        metrics = compute_daily_metric_for_coach(
            coach_id=self.coach.id,
            as_of_date=self.anchor,
            minutes_saved_per_completion=20,
        )
        self.assertEqual(metrics['active_students_30d'], 2)
        self.assertEqual(metrics['feedback_completions_7d'], 1)
        self.assertEqual(metrics['feedback_completions_30d'], 2)
        self.assertEqual(metrics['median_time_to_feedback_hours_30d'], Decimal('36.00'))
        self.assertEqual(metrics['estimated_time_saved_hours_30d'], Decimal('0.67'))

    def test_compute_daily_metric_for_non_coach_returns_zeroes(self):
        non_coach = User.objects.create_user(username='no-space-owner', password='pass1234')
        metrics = compute_daily_metric_for_coach(
            coach_id=non_coach.id,
            as_of_date=self.anchor,
            minutes_saved_per_completion=20,
        )
        self.assertEqual(metrics['active_students_30d'], 0)
        self.assertEqual(metrics['feedback_completions_7d'], 0)
        self.assertEqual(metrics['feedback_completions_30d'], 0)
        self.assertIsNone(metrics['median_time_to_feedback_hours_30d'])
        self.assertEqual(metrics['estimated_time_saved_hours_30d'], Decimal('0.00'))

    @override_settings(COACH_METRICS_MINUTES_SAVED_PER_COMPLETION=20)
    def test_build_command_is_idempotent(self):
        call_command('build_coach_metrics', days=2, date=str(self.anchor))
        first_count = CoachDailyMetric.objects.filter(coach=self.coach).count()
        call_command('build_coach_metrics', days=2, date=str(self.anchor))
        second_count = CoachDailyMetric.objects.filter(coach=self.coach).count()
        self.assertEqual(first_count, 2)
        self.assertEqual(second_count, 2)


class CoachMetricsSummaryApiTests(APITestCase):
    def setUp(self):
        self.coach = User.objects.create_user(username='coach-api', password='pass1234')
        self.other = User.objects.create_user(username='coach-other', password='pass1234')
        self.metric_dates = [
            timezone.now().date() - timedelta(days=2),
            timezone.now().date() - timedelta(days=1),
            timezone.now().date(),
        ]
        for i, metric_date in enumerate(self.metric_dates):
            CoachDailyMetric.objects.create(
                coach=self.coach,
                date=metric_date,
                active_students_30d=3 + i,
                feedback_completions_7d=5 + i,
                feedback_completions_30d=7 + i,
                median_time_to_feedback_hours_30d=Decimal('12.50') + Decimal(i),
                estimated_time_saved_hours_30d=Decimal('2.00') + Decimal(i),
            )
        CoachDailyMetric.objects.create(
            coach=self.other,
            date=timezone.now().date(),
            active_students_30d=99,
            feedback_completions_7d=99,
            feedback_completions_30d=99,
            median_time_to_feedback_hours_30d=Decimal('99.99'),
            estimated_time_saved_hours_30d=Decimal('99.99'),
        )

    @override_settings(COACH_METRICS_ENABLED=False)
    def test_feature_disabled_returns_404(self):
        self.client.force_authenticate(user=self.coach)
        response = self.client.get('/api/coach-metrics/summary/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(COACH_METRICS_ENABLED=True)
    def test_auth_required(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/coach-metrics/summary/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(COACH_METRICS_ENABLED=True)
    def test_invalid_window_days(self):
        self.client.force_authenticate(user=self.coach)
        response = self.client.get('/api/coach-metrics/summary/?window_days=14')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(COACH_METRICS_ENABLED=True, COACH_METRICS_INTERNAL_USER_IDS=[999999])
    def test_internal_allowlist_gate_returns_404_for_non_allowlisted_user(self):
        self.client.force_authenticate(user=self.coach)
        response = self.client.get('/api/coach-metrics/summary/?window_days=30')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(COACH_METRICS_ENABLED=True)
    def test_summary_and_trends_ordered_for_current_user_only(self):
        self.client.force_authenticate(user=self.coach)
        response = self.client.get('/api/coach-metrics/summary/?window_days=30')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['coach_user_id'], self.coach.id)
        self.assertEqual(response.data['summary']['active_students_30d'], 5)
        self.assertEqual(response.data['summary']['feedback_completions_7d'], 7)
        self.assertEqual(response.data['summary']['median_time_to_feedback_hours_30d'], 14.5)
        self.assertEqual(response.data['summary']['estimated_time_saved_hours_30d'], 4.0)

        trend_dates = [row['date'] for row in response.data['trends']['active_students_30d']]
        self.assertEqual(trend_dates, sorted(trend_dates))
        self.assertEqual(len(trend_dates), 3)
