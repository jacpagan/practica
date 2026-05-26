from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from videos.models import ProductEventLog, Session

LOOP_PROOF_SAVED = 'proof_saved'
LOOP_TODAY_VIEWED = 'today_viewed'
LOOP_SAVE_LANDED_TODAY = 'loop_save_landed_today'
LOOP_PROOF_PLAYBACK_STARTED = 'proof_playback_started'


def _event_session_id(extra_json):
    if not isinstance(extra_json, dict):
        return None
    raw = extra_json.get('session_id')
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _local_date(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        return value.date()
    return timezone.localtime(value).date()


def _display_name_for(user):
    profile = getattr(user, 'profile', None)
    if profile and profile.display_name:
        return profile.display_name
    return user.username


def _session_ids_from_events(events_qs, event_name):
    session_ids = set()
    for extra_json in events_qs.filter(event_name=event_name).values_list('extra_json', flat=True):
        session_id = _event_session_id(extra_json)
        if session_id is not None:
            session_ids.add(session_id)
    return session_ids


def build_loop_metrics(*, days=30, username=''):
    User = get_user_model()
    now = timezone.now()
    threshold = now - timedelta(days=max(1, int(days)))
    seven_days_ago = now - timedelta(days=7)

    users_qs = User.objects.filter(sessions__isnull=False).distinct().select_related('profile')
    normalized_username = str(username or '').strip()
    if normalized_username:
        users_qs = users_qs.filter(username=normalized_username)

    rows = []
    for user in users_qs.order_by('username'):
        window_sessions = list(
            Session.objects.filter(user=user, recorded_at__gte=threshold)
            .order_by('recorded_at')
            .values('id', 'recorded_at')
        )
        all_sessions = list(
            Session.objects.filter(user=user)
            .order_by('recorded_at')
            .values('id', 'recorded_at')
        )
        if not all_sessions:
            continue

        proof_count = len(window_sessions)
        unique_proof_days = len({_local_date(item['recorded_at']) for item in window_sessions if item['recorded_at']})
        proofs_last_7d = sum(1 for item in window_sessions if item['recorded_at'] and item['recorded_at'] >= seven_days_ago)

        first_proof_at = all_sessions[0]['recorded_at']
        last_proof_at = all_sessions[-1]['recorded_at']

        returned_d1 = False
        returned_d7 = False
        if len(all_sessions) > 1 and first_proof_at:
            d1_deadline = first_proof_at + timedelta(days=1)
            d7_deadline = first_proof_at + timedelta(days=7)
            for item in all_sessions[1:]:
                recorded_at = item['recorded_at']
                if not recorded_at:
                    continue
                if recorded_at <= d1_deadline:
                    returned_d1 = True
                if recorded_at <= d7_deadline:
                    returned_d7 = True
                if returned_d1 and returned_d7:
                    break

        events_qs = ProductEventLog.objects.filter(user=user, created_at__gte=threshold)
        today_views_last_7d = events_qs.filter(
            event_name=LOOP_TODAY_VIEWED,
            created_at__gte=seven_days_ago,
        ).count()

        window_session_ids = {item['id'] for item in window_sessions}
        playback_session_ids = _session_ids_from_events(events_qs, LOOP_PROOF_PLAYBACK_STARTED)
        landed_today_session_ids = _session_ids_from_events(events_qs, LOOP_SAVE_LANDED_TODAY)

        played_count = len(window_session_ids & playback_session_ids)
        landed_count = len(window_session_ids & landed_today_session_ids)
        playback_rate = round((played_count / proof_count) * 100) if proof_count else None
        save_to_today_rate = round((landed_count / proof_count) * 100) if proof_count else None

        rows.append({
            'user_id': user.id,
            'username': user.username,
            'display_name': _display_name_for(user),
            'proof_count': proof_count,
            'unique_proof_days': unique_proof_days,
            'proofs_last_7d': proofs_last_7d,
            'first_proof_at': first_proof_at.isoformat() if first_proof_at else '',
            'last_proof_at': last_proof_at.isoformat() if last_proof_at else '',
            'returned_d1': returned_d1,
            'returned_d7': returned_d7,
            'today_views_last_7d': today_views_last_7d,
            'playback_rate': playback_rate,
            'save_to_today_rate': save_to_today_rate,
        })

    return rows
