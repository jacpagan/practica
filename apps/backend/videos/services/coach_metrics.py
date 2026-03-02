from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal
from statistics import median

from django.db.models import Min

from videos.models import CoachDailyMetric, FeedbackAssignment, Session, Space


TWO_PLACES = Decimal('0.01')


def _window_bounds_utc(as_of_date, days):
    start_date = as_of_date - timedelta(days=days - 1)
    start_dt = datetime.combine(start_date, time.min, tzinfo=dt_timezone.utc)
    end_dt = datetime.combine(as_of_date + timedelta(days=1), time.min, tzinfo=dt_timezone.utc)
    return start_dt, end_dt


def _as_decimal(value):
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal('0')


def _quantize_hours(value):
    if value is None:
        return None
    return _as_decimal(value).quantize(TWO_PLACES)


def compute_daily_metric_for_coach(coach_id, as_of_date, minutes_saved_per_completion):
    owned_space_ids = list(Space.objects.filter(owner_id=coach_id).values_list('id', flat=True))
    if not owned_space_ids:
        return {
            'coach_id': coach_id,
            'date': as_of_date,
            'active_students_30d': 0,
            'feedback_completions_7d': 0,
            'feedback_completions_30d': 0,
            'median_time_to_feedback_hours_30d': None,
            'estimated_time_saved_hours_30d': Decimal('0.00'),
        }

    start_7d, end_dt = _window_bounds_utc(as_of_date, 7)
    start_30d, _ = _window_bounds_utc(as_of_date, 30)

    active_students_30d = (
        Session.objects.filter(
            space_id__in=owned_space_ids,
            created_at__gte=start_30d,
            created_at__lt=end_dt,
            user_id__isnull=False,
        )
        .exclude(user_id=coach_id)
        .values('user_id')
        .distinct()
        .count()
    )

    feedback_completions_7d = FeedbackAssignment.objects.filter(
        reviewer_id=coach_id,
        status=FeedbackAssignment.STATUS_COMPLETED,
        completed_at__gte=start_7d,
        completed_at__lt=end_dt,
    ).count()

    feedback_completions_30d = FeedbackAssignment.objects.filter(
        reviewer_id=coach_id,
        status=FeedbackAssignment.STATUS_COMPLETED,
        completed_at__gte=start_30d,
        completed_at__lt=end_dt,
    ).count()

    first_completion_rows = (
        FeedbackAssignment.objects.filter(
            feedback_request__space_id__in=owned_space_ids,
            feedback_request__created_at__gte=start_30d,
            feedback_request__created_at__lt=end_dt,
            status=FeedbackAssignment.STATUS_COMPLETED,
            completed_at__isnull=False,
        )
        .values('feedback_request_id', 'feedback_request__created_at')
        .annotate(first_completed_at=Min('completed_at'))
    )

    durations = []
    for row in first_completion_rows:
        created_at = row.get('feedback_request__created_at')
        first_completed_at = row.get('first_completed_at')
        if not created_at or not first_completed_at:
            continue
        hours = max(0, (first_completed_at - created_at).total_seconds() / 3600)
        durations.append(hours)

    median_time_to_feedback_hours_30d = _quantize_hours(median(durations)) if durations else None

    minutes_saved = max(Decimal('0'), _as_decimal(minutes_saved_per_completion))
    estimated_time_saved_hours_30d = _quantize_hours(
        (Decimal(feedback_completions_30d) * minutes_saved) / Decimal('60')
    )

    return {
        'coach_id': coach_id,
        'date': as_of_date,
        'active_students_30d': active_students_30d,
        'feedback_completions_7d': feedback_completions_7d,
        'feedback_completions_30d': feedback_completions_30d,
        'median_time_to_feedback_hours_30d': median_time_to_feedback_hours_30d,
        'estimated_time_saved_hours_30d': estimated_time_saved_hours_30d,
    }


def upsert_daily_metric(coach_id, as_of_date, metric_values):
    defaults = {
        'active_students_30d': int(metric_values.get('active_students_30d', 0)),
        'feedback_completions_7d': int(metric_values.get('feedback_completions_7d', 0)),
        'feedback_completions_30d': int(metric_values.get('feedback_completions_30d', 0)),
        'median_time_to_feedback_hours_30d': metric_values.get('median_time_to_feedback_hours_30d'),
        'estimated_time_saved_hours_30d': metric_values.get('estimated_time_saved_hours_30d') or Decimal('0.00'),
    }
    metric, _ = CoachDailyMetric.objects.update_or_create(
        coach_id=coach_id,
        date=as_of_date,
        defaults=defaults,
    )
    return metric
