import logging
import os
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django_ratelimit.decorators import ratelimit
from rest_framework import status, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import ProductEventLog, SignupInviteCode
from .serializers import (
    UserSerializer, UserSummarySerializer, RegisterSerializer,
    SignupInviteCodeSerializer,
)
from .services.media_pipeline import (
    local_transcode_enabled,
    media_pipeline_enabled,
)
from .telemetry import PRODUCT_EVENT_SOURCE, log_product_event, sanitized_event_path

logger = logging.getLogger(__name__)


# ── Auth views ──────────────────────────────────────────────────────

@csrf_exempt
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


@csrf_exempt
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
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_search_view(request):
    query = str(request.query_params.get('q', '')).strip()
    qs = User.objects.select_related('profile').exclude(pk=request.user.pk).order_by('username')
    if query:
        qs = qs.filter(Q(username__icontains=query) | Q(profile__display_name__icontains=query))
    return Response(UserSummarySerializer(qs[:10], many=True).data)


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


@csrf_exempt
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
        ProductEventLog.objects.create(
            event_name=message[:80] or 'unknown',
            path=path,
            user=request.user if getattr(request.user, 'is_authenticated', False) else None,
            is_authenticated=bool(getattr(request.user, 'is_authenticated', False)),
            client_trace_id=client_trace_id,
            extra_json=extra,
        )
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

    return Response({
        'window_hours': window_hours,
        'event_name': event_name_filter,
        'total_events': qs.count(),
        'top_events': top_events,
        'top_paths': top_paths,
        'recent_events': recent_events,
    })


# ── Legacy product surfaces removed ─────────────────────────────────


# ── Health check ────────────────────────────────────────────────────

def health_check(request):
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {},
        'video_processing': {
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
