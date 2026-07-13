import logging
import os
from collections import Counter
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django_ratelimit.decorators import ratelimit
from rest_framework import status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import ProductEventLog, Session, SignupInviteCode
from .serializers import (
    UserSerializer, RegisterSerializer,
    SignupInviteCodeSerializer,
)
from .services.media_pipeline import (
    configured_video_processing_mode,
    local_transcode_enabled,
    media_pipeline_enabled,
)
from .telemetry import PRODUCT_EVENT_SOURCE, log_product_event, sanitized_event_path

logger = logging.getLogger(__name__)


# ── Auth views ──────────────────────────────────────────────────────

@ratelimit(key='ip', rate='5/h', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        try:
            user = serializer.save()
        except serializers.ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '')
    password = request.data.get('password', '')
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    logger.info(
        'auth_me_resolved user_id=%s username=%s path=%s',
        getattr(request.user, 'id', None),
        getattr(request.user, 'username', ''),
        request.path,
    )
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_search_view(request):
    query = str(request.query_params.get('q', '')).strip()
    qs = User.objects.select_related('profile').exclude(pk=request.user.pk).order_by('username')
    if query:
        qs = qs.filter(Q(username__icontains=query) | Q(profile__display_name__icontains=query))
    data = []
    for user in qs[:10]:
        display_name = user.username
        profile = getattr(user, 'profile', None)
        if profile and getattr(profile, 'display_name', ''):
            display_name = profile.display_name
        data.append({'id': user.id, 'username': user.username, 'display_name': display_name})
    return Response(data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def invite_codes(request):
    if request.method == 'GET':
        codes = SignupInviteCode.objects.filter(created_by=request.user).order_by('-created_at')
        return Response(SignupInviteCodeSerializer(codes, many=True).data)

    active_count = SignupInviteCode.objects.filter(created_by=request.user, is_active=True).count()
    if active_count >= 10:
        return Response({'error': 'You already have too many active invite codes.'}, status=status.HTTP_400_BAD_REQUEST)

    label = str(request.data.get('label', '')).strip()
    max_uses = 1
    if request.user.is_staff:
        try:
            max_uses = max(1, min(100, int(request.data.get('max_uses', 1))))
        except (TypeError, ValueError):
            max_uses = 1

    invite = SignupInviteCode.objects.create(
        label=label,
        created_by=request.user,
        max_uses=max_uses,
    )
    return Response(SignupInviteCodeSerializer(invite).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def invite_code_detail(request, invite_id):
    invite = get_object_or_404(SignupInviteCode, pk=invite_id)
    if request.user != invite.created_by and not request.user.is_staff:
        return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
    invite.is_active = False
    invite.save(update_fields=['is_active', 'updated_at'])
    return Response({'ok': True})


@ratelimit(key='ip', rate='30/m', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def client_error_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    source = str(payload.get('source', '')).strip()[:64]
    path = sanitized_event_path(payload.get('path', ''))[:512]
    extra = payload.get('extra') if isinstance(payload.get('extra'), dict) else {}
    client_trace_id = str(extra.get('client_trace_id', '')).strip()[:128]
    message = str(payload.get('message', '')).strip()
    stack = str(payload.get('stack', '')).strip()

    if source == PRODUCT_EVENT_SOURCE:
        log_product_event(logger, request, event_name=message, extra=extra, path_override=path)
        return Response({'ok': True}, status=status.HTTP_202_ACCEPTED)

    request_id = request.META.get('HTTP_X_REQUEST_ID', '')
    logger.warning(
        'ClientError source=%s path=%s is_authenticated=%s request_id=%s client_trace_id=%s message_len=%s stack_present=%s',
        source or 'unknown',
        path or 'unknown',
        bool(getattr(request.user, 'is_authenticated', False)),
        request_id,
        client_trace_id or 'n/a',
        len(message),
        bool(stack),
    )
    return Response({'ok': True}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_event_insights_view(request):
    if not request.user.is_staff:
        return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

    try:
        window_hours = max(1, min(24 * 30, int(request.query_params.get('window_hours', 24))))
    except (TypeError, ValueError):
        window_hours = 24
    try:
        limit = max(1, min(50, int(request.query_params.get('limit', 10))))
    except (TypeError, ValueError):
        limit = 10

    threshold = timezone.now() - timezone.timedelta(hours=window_hours)
    event_name_filter = str(request.query_params.get('event_name', '')).strip()

    qs = ProductEventLog.objects.filter(created_at__gte=threshold)
    if event_name_filter:
        qs = qs.filter(event_name=event_name_filter)

    top_events = list(
        qs.values('event_name').annotate(count=Count('id')).order_by('-count', 'event_name')[:limit]
    )
    top_paths = list(
        qs.exclude(path='').values('path').annotate(count=Count('id')).order_by('-count', 'path')[:limit]
    )
    recent_events = list(
        qs.values('id', 'event_name', 'path', 'is_authenticated', 'client_trace_id', 'extra_json', 'created_at')
        .order_by('-created_at')[:limit]
    )

    upload_events_qs = qs.filter(event_name__in=[
        'session_upload_started',
        'session_upload_succeeded',
        'session_upload_failed',
        'session_upload_aborted',
        'session_upload_paused',
    ])
    upload_rows = list(upload_events_qs.values('event_name', 'extra_json'))
    upload_mode_counts = Counter()
    failure_code_counts = Counter()
    failure_status_counts = Counter()
    failure_phase_counts = Counter()

    upload_succeeded_count = 0
    upload_failed_count = 0
    upload_aborted_count = 0
    upload_started_count = 0
    upload_paused_count = 0
    completed_durations_ms = []
    for row in upload_rows:
        event_name = str(row.get('event_name', '')).strip()
        extra = row.get('extra_json') if isinstance(row.get('extra_json'), dict) else {}
        mode = str(extra.get('upload_mode', '')).strip().lower() or 'unknown'
        upload_mode_counts[mode] += 1

        if event_name == 'session_upload_started':
            upload_started_count += 1
            continue
        if event_name == 'session_upload_succeeded':
            upload_succeeded_count += 1
            duration_ms = extra.get('duration_ms')
            if isinstance(duration_ms, int) and duration_ms >= 0:
                completed_durations_ms.append(duration_ms)
            continue
        if event_name == 'session_upload_aborted':
            upload_aborted_count += 1
            continue
        if event_name == 'session_upload_paused':
            upload_paused_count += 1
            continue

        upload_failed_count += 1
        failure_code = str(extra.get('code', '')).strip().lower() or 'unknown'
        failure_status = str(extra.get('status', '')).strip() or 'unknown'
        failure_phase = str(extra.get('phase', '')).strip().lower() or 'unknown'
        failure_code_counts[failure_code] += 1
        failure_status_counts[failure_status] += 1
        failure_phase_counts[failure_phase] += 1

    upload_summary = {
        'total_upload_events': len(upload_rows),
        'upload_succeeded_count': upload_succeeded_count,
        'upload_failed_count': upload_failed_count,
        'upload_aborted_count': upload_aborted_count,
        'upload_started_count': upload_started_count,
        'upload_paused_count': upload_paused_count,
        'avg_success_duration_ms': int(sum(completed_durations_ms) / len(completed_durations_ms)) if completed_durations_ms else 0,
        'upload_mode_counts': [{'upload_mode': mode, 'count': count} for mode, count in upload_mode_counts.most_common(limit)],
        'top_failure_codes': [{'code': code, 'count': count} for code, count in failure_code_counts.most_common(limit)],
        'top_failure_statuses': [{'status': status_value, 'count': count} for status_value, count in failure_status_counts.most_common(limit)],
        'top_failure_phases': [{'phase': phase, 'count': count} for phase, count in failure_phase_counts.most_common(limit)],
    }

    return Response({
        'window_hours': window_hours,
        'event_name': event_name_filter,
        'total_events': qs.count(),
        'top_events': top_events,
        'top_paths': top_paths,
        'recent_events': recent_events,
        'upload_summary': upload_summary,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def internal_metrics_view(request):
    if not request.user.is_staff:
        return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

    now = timezone.now()
    day_ago = now - timezone.timedelta(days=1)
    seven_days_ago = now - timezone.timedelta(days=7)
    thirty_days_ago = now - timezone.timedelta(days=30)

    sessions_qs = Session.objects.select_related('user').all()
    events_qs = ProductEventLog.objects.select_related('user').all()

    def session_count_since(threshold):
        return sessions_qs.filter(recorded_at__gte=threshold).count()

    def active_user_count_since(threshold):
        session_user_ids = set(
            sessions_qs
            .filter(recorded_at__gte=threshold, user__isnull=False)
            .values_list('user_id', flat=True)
        )
        event_user_ids = set(
            events_qs
            .filter(created_at__gte=threshold, user__isnull=False)
            .values_list('user_id', flat=True)
        )
        return len(session_user_ids | event_user_ids)

    upload_event_names = [
        'session_upload_started',
        'session_upload_succeeded',
        'session_upload_failed',
        'session_upload_aborted',
        'session_upload_paused',
    ]
    upload_events = list(
        events_qs
        .filter(created_at__gte=thirty_days_ago, event_name__in=upload_event_names)
        .values('event_name', 'extra_json')
    )
    upload_counts = Counter(row['event_name'] for row in upload_events)
    upload_bytes = 0
    upload_durations_ms = []
    upload_failure_codes = Counter()
    for row in upload_events:
        extra = row.get('extra_json') if isinstance(row.get('extra_json'), dict) else {}
        if row['event_name'] == 'session_upload_succeeded':
            size = extra.get('file_size_bytes')
            if isinstance(size, int) and size > 0:
                upload_bytes += size
            duration = extra.get('duration_ms')
            if isinstance(duration, int) and duration >= 0:
                upload_durations_ms.append(duration)
        if row['event_name'] == 'session_upload_failed':
            upload_failure_codes[str(extra.get('code') or 'unknown')] += 1

    first_sessions = {}
    repeat_users_1d = set()
    repeat_users_7d = set()
    for item in sessions_qs.filter(user__isnull=False).order_by('user_id', 'recorded_at').values('user_id', 'recorded_at'):
        user_id = item['user_id']
        recorded_at = item['recorded_at']
        if not user_id or not recorded_at:
            continue
        first_at = first_sessions.get(user_id)
        if first_at is None:
            first_sessions[user_id] = recorded_at
            continue
        if recorded_at <= first_at + timezone.timedelta(days=1):
            repeat_users_1d.add(user_id)
        if recorded_at <= first_at + timezone.timedelta(days=7):
            repeat_users_7d.add(user_id)

    latest_events = list(
        events_qs
        .values('event_name', 'path', 'is_authenticated', 'extra_json', 'created_at', 'user__username')
        .order_by('-created_at')[:12]
    )
    latest_proofs = list(
        sessions_qs
        .values('id', 'title', 'practice_series', 'processing_status', 'recorded_at', 'user__username')
        .order_by('-recorded_at')[:12]
    )

    return Response({
        'generated_at': now.isoformat(),
        'people': {
            'total_users': User.objects.count(),
            'staff_users': User.objects.filter(is_staff=True).count(),
            'users_with_proofs': sessions_qs.filter(user__isnull=False).values('user_id').distinct().count(),
            'active_24h': active_user_count_since(day_ago),
            'active_7d': active_user_count_since(seven_days_ago),
            'active_30d': active_user_count_since(thirty_days_ago),
        },
        'proofs': {
            'total': sessions_qs.count(),
            'last_24h': session_count_since(day_ago),
            'last_7d': session_count_since(seven_days_ago),
            'last_30d': session_count_since(thirty_days_ago),
            'ready': sessions_qs.filter(processing_status=Session.STATUS_READY).count(),
            'processing': sessions_qs.filter(processing_status=Session.STATUS_PROCESSING).count(),
            'failed': sessions_qs.filter(processing_status=Session.STATUS_FAILED).count(),
        },
        'uploads_30d': {
            'started': upload_counts.get('session_upload_started', 0),
            'succeeded': upload_counts.get('session_upload_succeeded', 0),
            'failed': upload_counts.get('session_upload_failed', 0),
            'paused': upload_counts.get('session_upload_paused', 0),
            'aborted': upload_counts.get('session_upload_aborted', 0),
            'success_file_bytes': upload_bytes,
            'avg_success_duration_ms': int(sum(upload_durations_ms) / len(upload_durations_ms)) if upload_durations_ms else 0,
            'top_failure_codes': [{'code': code, 'count': count} for code, count in upload_failure_codes.most_common(6)],
        },
        'retention': {
            'users_with_first_proof': len(first_sessions),
            'repeat_within_1d': len(repeat_users_1d),
            'repeat_within_7d': len(repeat_users_7d),
        },
        'skills': {
            'top': list(
                sessions_qs
                .exclude(practice_series='')
                .values('practice_series')
                .annotate(count=Count('id'))
                .order_by('-count', 'practice_series')[:10]
            ),
            'tagged_proofs': sessions_qs.exclude(practice_series='').count(),
            'untagged_proofs': sessions_qs.filter(practice_series='').count(),
        },
        'events_30d': {
            'total': events_qs.filter(created_at__gte=thirty_days_ago).count(),
            'top': list(
                events_qs
                .filter(created_at__gte=thirty_days_ago)
                .values('event_name')
                .annotate(count=Count('id'))
                .order_by('-count', 'event_name')[:10]
            ),
        },
        'latest_events': latest_events,
        'latest_proofs': latest_proofs,
    })


# ── Legacy product surfaces removed ─────────────────────────────────


# ── Health check ────────────────────────────────────────────────────

def health_check(request):
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {},
        'video_processing': {
            'mode': getattr(settings, 'VIDEO_PROCESSING_MODE', 'auto'),
            'configured_mode': configured_video_processing_mode(),
            'local_ffmpeg': local_transcode_enabled(),
            'mediaconvert': media_pipeline_enabled(),
        },
        'version': '3.0.0',
        'environment': 'development' if settings.DEBUG else 'production',
        'deployed_sha': os.getenv('DEPLOYED_GIT_SHA', ''),
    }
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status['services']['database'] = 'healthy'
    except Exception as e:
        health_status['services']['database'] = f'unhealthy: {e}'
        health_status['status'] = 'unhealthy'
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)


def ready_check(request):
    frontend_index = None
    frontend_dir = getattr(settings, 'FRONTEND_DIR', None)
    if frontend_dir:
        frontend_index = str(frontend_dir / 'index.html')

    ready_status = {
        'status': 'ready',
        'timestamp': timezone.now().isoformat(),
        'checks': {},
        'deployed_sha': os.getenv('DEPLOYED_GIT_SHA', ''),
    }

    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        ready_status['checks']['database'] = 'ready'
    except Exception as exc:
        ready_status['checks']['database'] = f'error: {exc}'
        ready_status['status'] = 'not_ready'

    if frontend_index and os.path.exists(frontend_index):
        ready_status['checks']['frontend_bundle'] = 'ready'
    else:
        ready_status['checks']['frontend_bundle'] = 'missing'
        ready_status['status'] = 'not_ready'

    status_code = 200 if ready_status['status'] == 'ready' else 503
    return JsonResponse(ready_status, status=status_code)


def favicon(request):
    """Serve a tiny blank favicon to avoid 404/502 noise.

    Many browsers request /favicon.ico by default; serving an empty icon prevents gateway errors
    if static assets aren't available yet.
    """
    resp = HttpResponse(b"", content_type='image/x-icon', status=200)
    resp['Cache-Control'] = 'public, max-age=86400'
    return resp
