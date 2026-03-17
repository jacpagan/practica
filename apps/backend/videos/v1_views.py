import math
import secrets
import uuid
from datetime import timedelta

from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    AnalyticsDaily,
    Comment,
    MultipartSessionUpload,
    Profile,
    ReviewLink,
    Session,
)
from .serializers import PublicSessionSerializer, ReviewFeedbackSerializer, ReviewLinkSerializer, UserSerializer
from .services.notifications import send_notification
from .tasks import process_uploaded_session
from .views import _list_uploaded_parts, _recommended_part_size, _s3_client, _start_processing_pipeline

ALLOWED_UPLOAD_EXTENSIONS = {'.mp4', '.mov', '.m4v'}


def _email_username(email: str) -> str:
    local = (email.split('@', 1)[0] if '@' in email else email).strip().lower()
    local = ''.join(ch for ch in local if ch.isalnum() or ch in {'-', '_', '.'})
    local = (local or 'user')[:120]
    candidate = local
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f'{local}-{suffix}'
        suffix += 1
    return candidate


def _session_visible_to(user, session):
    if user.is_staff:
        return True
    if _role(user) in {Profile.ROLE_COACH, Profile.ROLE_ADMIN}:
        return True
    return session.user_id == user.id


def _role(user):
    if not hasattr(user, 'profile'):
        return Profile.ROLE_STUDENT
    return user.profile.role or Profile.ROLE_STUDENT


def _serialize_session(session, request_user=None):
    can_edit = False
    if request_user and request_user.is_authenticated:
        can_edit = request_user.is_staff or request_user.id == session.user_id
    owner = None
    if session.user_id and session.user:
        display_name = session.user.profile.display_name if hasattr(session.user, 'profile') and session.user.profile.display_name else session.user.email
        owner = {'id': session.user_id, 'display_name': display_name}
    return {
        'id': session.id,
        'title': session.title,
        'description': session.description,
        'recorded_at': session.recorded_at,
        'duration_seconds': session.duration_seconds,
        'status': session.status,
        'owner_user_id': session.user_id,
        'source_video_object_key': session.source_video_object_key or '',
        'playback_hls_url': session.playback_hls_url or '',
        'playback_mp4_url': session.playback_mp4_url or '',
        'thumbnail_url': session.thumbnail_url or '',
        'processing_error': session.processing_error or '',
        'owner': owner,
        'can_edit': can_edit,
        'created_at': session.created_at,
        'updated_at': session.updated_at,
    }


@csrf_exempt
@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def v1_register(request):
    email = str(request.data.get('email', '')).strip().lower()
    password = str(request.data.get('password', ''))
    display_name = str(request.data.get('display_name', '')).strip()
    role = str(request.data.get('role', Profile.ROLE_STUDENT)).strip().lower()
    if role not in {Profile.ROLE_STUDENT, Profile.ROLE_COACH, Profile.ROLE_ADMIN}:
        return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
    if not email or '@' not in email:
        return Response({'error': 'Valid email is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6:
        return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email is already registered'}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=_email_username(email), email=email, password=password)
    Profile.objects.update_or_create(
        user=user,
        defaults={'display_name': display_name or email.split('@', 1)[0], 'role': role},
    )
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


@csrf_exempt
@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def v1_login(request):
    email = str(request.data.get('email', '')).strip().lower()
    password = str(request.data.get('password', ''))
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    authed = authenticate(username=user.username, password=password)
    if not authed:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    token, _ = Token.objects.get_or_create(user=authed)
    return Response({'token': token.key, 'user': UserSerializer(authed).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def v1_logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def v1_me(request):
    return Response(UserSerializer(request.user).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def v1_sessions(request):
    if request.method == 'GET':
        qs = Session.objects.filter(user=request.user).order_by('-created_at')
        return Response([_serialize_session(row, request.user) for row in qs])

    title = str(request.data.get('title', '')).strip()
    if not title:
        return Response({'error': 'title is required'}, status=status.HTTP_400_BAD_REQUEST)
    raw_duration = request.data.get('duration_seconds', None)
    try:
        duration_seconds = int(raw_duration) if raw_duration not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'error': 'duration_seconds must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    recorded_at = request.data.get('recorded_at')
    if recorded_at:
        try:
            recorded_at = timezone.datetime.fromisoformat(str(recorded_at).replace('Z', '+00:00'))
        except ValueError:
            return Response({'error': 'recorded_at must be ISO-8601'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        recorded_at = timezone.now()

    session = Session.objects.create(
        user=request.user,
        title=title,
        description=str(request.data.get('description', '')).strip(),
        recorded_at=recorded_at,
        duration_seconds=duration_seconds,
        status=Session.STATUS_DRAFT,
        processing_status=Session.STATUS_DRAFT,
        video_file='sessions/draft-placeholder.mp4',
    )
    return Response(_serialize_session(session, request.user), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def v1_session_detail(request, session_id):
    session = get_object_or_404(Session, pk=session_id)
    if not _session_visible_to(request.user, session):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(_serialize_session(session, request.user))

    if request.method == 'DELETE':
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    for field in ['title', 'description']:
        if field in request.data:
            setattr(session, field, str(request.data.get(field, '')).strip())
    if 'duration_seconds' in request.data:
        raw = request.data.get('duration_seconds')
        session.duration_seconds = int(raw) if str(raw).strip() else None
    if 'status' in request.data:
        next_status = str(request.data.get('status', '')).strip().lower()
        allowed = {choice[0] for choice in Session.STATUS_CHOICES}
        if next_status not in allowed:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        session.status = next_status
    session.save()
    return Response(_serialize_session(session, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def v1_upload_request(request):
    filename = str(request.data.get('filename', '')).strip()
    content_type = str(request.data.get('content_type', '')).strip().lower()
    try:
        size_bytes = int(request.data.get('size_bytes', 0))
    except (TypeError, ValueError):
        return Response({'error': 'size_bytes must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
    if not filename:
        return Response({'error': 'filename is required'}, status=status.HTTP_400_BAD_REQUEST)
    if size_bytes <= 0:
        return Response({'error': 'size_bytes must be > 0'}, status=status.HTTP_400_BAD_REQUEST)

    ext = f".{filename.rsplit('.', 1)[-1].lower()}" if '.' in filename else ''
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        return Response({'error': 'Only mp4/mov/m4v are supported'}, status=status.HTTP_400_BAD_REQUEST)
    if not content_type.startswith('video/'):
        return Response({'error': 'content_type must be video/*'}, status=status.HTTP_400_BAD_REQUEST)

    max_bytes = int(getattr(settings, 'UPLOAD_MAX_BYTES', 2147483648))
    if size_bytes > max_bytes:
        return Response({'error': 'File exceeds max upload size'}, status=status.HTTP_400_BAD_REQUEST)

    session = None
    session_id = request.data.get('session_id')
    if session_id:
        session = get_object_or_404(Session, pk=session_id, user=request.user)

    if not getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''):
        return Response({'error': 'Direct upload storage is not configured'}, status=status.HTTP_400_BAD_REQUEST)

    key = f"sessions/{request.user.id}/{uuid.uuid4().hex}-{filename}"
    try:
        create_kwargs = {'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key, 'ContentType': content_type}
        resp = _s3_client().create_multipart_upload(**create_kwargs)
    except (BotoCoreError, ClientError):
        return Response({'error': 'Could not initiate upload'}, status=status.HTTP_502_BAD_GATEWAY)

    part_size = _recommended_part_size(size_bytes)
    total_parts = math.ceil(size_bytes / part_size)
    upload = MultipartSessionUpload.objects.create(
        user=request.user,
        session=session,
        status=MultipartSessionUpload.STATUS_INITIATED,
        title=session.title if session else filename.rsplit('.', 1)[0],
        description=session.description if session else '',
        original_filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        s3_key=key,
        s3_upload_id=resp['UploadId'],
        expires_at=timezone.now() + timedelta(hours=24),
    )
    if session:
        session.status = Session.STATUS_UPLOAD_IN_PROGRESS
        session.processing_status = Session.STATUS_UPLOAD_IN_PROGRESS
        session.save(update_fields=['status', 'processing_status', 'updated_at'])

    return Response({
        'upload_id': upload.id,
        'object_key': upload.s3_key,
        'provider_upload_id': upload.s3_upload_id,
        'upload_provider': 's3-multipart',
        'part_size': part_size,
        'total_parts': total_parts,
        'expires_at': upload.expires_at,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def v1_upload_sign_part(request, upload_id):
    upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
    try:
        part_number = int(request.data.get('part_number'))
    except (TypeError, ValueError):
        return Response({'error': 'part_number is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        signed_url = _s3_client().generate_presigned_url(
            ClientMethod='upload_part',
            Params={
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                'Key': upload.s3_key,
                'UploadId': upload.s3_upload_id,
                'PartNumber': part_number,
            },
            ExpiresIn=3600,
            HttpMethod='PUT',
        )
    except (BotoCoreError, ClientError):
        return Response({'error': 'Could not sign part'}, status=status.HTTP_502_BAD_GATEWAY)
    upload.status = MultipartSessionUpload.STATUS_UPLOADING
    upload.save(update_fields=['status', 'updated_at'])
    return Response({'signed_url': signed_url})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def v1_upload_status(request, upload_id):
    upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
    part_size = _recommended_part_size(upload.size_bytes)
    total_parts = math.ceil(upload.size_bytes / part_size)
    uploaded_parts = []
    if upload.status in {MultipartSessionUpload.STATUS_INITIATED, MultipartSessionUpload.STATUS_UPLOADING}:
        try:
            uploaded_parts = _list_uploaded_parts(upload)
        except (BotoCoreError, ClientError):
            uploaded_parts = []
    return Response({
        'upload_id': upload.id,
        'status': upload.status,
        'expires_at': upload.expires_at,
        'part_size': part_size,
        'total_parts': total_parts,
        'uploaded_parts': uploaded_parts,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def v1_upload_complete(request, upload_id):
    upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
    if upload.status not in {MultipartSessionUpload.STATUS_INITIATED, MultipartSessionUpload.STATUS_UPLOADING}:
        return Response({'error': 'Upload is not open'}, status=status.HTTP_400_BAD_REQUEST)

    parts = request.data.get('parts') or []
    if not isinstance(parts, list) or not parts:
        return Response({'error': 'parts are required'}, status=status.HTTP_400_BAD_REQUEST)
    normalized = []
    for row in parts:
        try:
            normalized.append({'PartNumber': int(row.get('part_number')), 'ETag': str(row.get('etag', '')).strip()})
        except Exception:
            return Response({'error': 'Invalid part payload'}, status=status.HTTP_400_BAD_REQUEST)
    normalized = sorted(normalized, key=lambda p: p['PartNumber'])

    try:
        _s3_client().complete_multipart_upload(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=upload.s3_key,
            UploadId=upload.s3_upload_id,
            MultipartUpload={'Parts': normalized},
        )
    except (BotoCoreError, ClientError):
        return Response({'error': 'Could not finalize upload'}, status=status.HTTP_502_BAD_GATEWAY)

    with transaction.atomic():
        if upload.session_id:
            session = upload.session
            session.video_file = upload.s3_key
            session.title = session.title or upload.title
            session.description = session.description or upload.description
        else:
            session = Session.objects.create(
                user=request.user,
                title=upload.title,
                description=upload.description,
                video_file=upload.s3_key,
                status=Session.STATUS_UPLOADED,
                processing_status=Session.STATUS_UPLOADED,
                source_video_object_key=upload.s3_key,
            )
            upload.session = session
        session.source_video_object_key = upload.s3_key
        session.status = Session.STATUS_UPLOADED
        session.processing_status = Session.STATUS_UPLOADED
        session.save()
        upload.status = MultipartSessionUpload.STATUS_COMPLETED
        upload.completed_at = timezone.now()
        upload.save(update_fields=['status', 'completed_at', 'session', 'updated_at'])

    try:
        process_uploaded_session.delay(session.id)
    except Exception:
        _start_processing_pipeline(session)
    return Response({'session': _serialize_session(session, request.user), 'upload_id': upload.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def v1_upload_abort(request, upload_id):
    upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
    if upload.status in {MultipartSessionUpload.STATUS_ABORTED, MultipartSessionUpload.STATUS_COMPLETED}:
        return Response({'status': upload.status})
    try:
        _s3_client().abort_multipart_upload(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=upload.s3_key,
            UploadId=upload.s3_upload_id,
        )
    except (BotoCoreError, ClientError):
        pass
    upload.status = MultipartSessionUpload.STATUS_ABORTED
    upload.save(update_fields=['status', 'updated_at'])
    return Response({'status': upload.status})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def v1_session_comments(request, session_id):
    session = get_object_or_404(Session, pk=session_id)
    if not _session_visible_to(request.user, session):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        rows = Comment.objects.filter(session=session).order_by('timestamp_seconds', 'created_at')
        return Response([
            {
                'id': row.id,
                'session_id': row.session_id,
                'author_user_id': row.user_id,
                'timestamp_seconds': row.timestamp_seconds,
                'body': row.text,
                'created_at': row.created_at,
            }
            for row in rows
        ])
    if _role(request.user) not in {Profile.ROLE_COACH, Profile.ROLE_ADMIN} and not request.user.is_staff:
        return Response({'error': 'Only coaches can leave comments'}, status=status.HTTP_403_FORBIDDEN)
    body = str(request.data.get('body', '')).strip()
    if not body:
        return Response({'error': 'body is required'}, status=status.HTTP_400_BAD_REQUEST)
    ts = request.data.get('timestamp_seconds')
    timestamp_seconds = int(ts) if str(ts).strip() else None
    row = Comment.objects.create(
        session=session,
        user=request.user,
        timestamp_seconds=timestamp_seconds,
        text=body,
        legacy_text_only=True,
    )
    if session.user_id and session.user_id != request.user.id and session.user.email:
        send_notification(
            subject='New coach feedback on your Practica session',
            body=f'You received new timestamped feedback on "{session.title}".',
            recipients=[session.user.email],
        )
    return Response({
        'id': row.id,
        'session_id': row.session_id,
        'author_user_id': row.user_id,
        'timestamp_seconds': row.timestamp_seconds,
        'body': row.text,
        'created_at': row.created_at,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def v1_session_review_links(request, session_id):
    session = get_object_or_404(Session, pk=session_id)
    if not _session_visible_to(request.user, session):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.user.id != session.user_id and not request.user.is_staff:
        return Response({'error': 'Only owner/admin can manage review links'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        rows = ReviewLink.objects.filter(session=session).order_by('-created_at')
        return Response([
            {
                'id': row.id,
                'session_id': row.session_id,
                'token': row.token,
                'created_by_user_id': row.created_by_id,
                'expires_at': row.expires_at,
                'is_active': row.is_active,
                'allow_comments': row.allow_comments,
                'last_accessed_at': row.last_accessed_at,
            }
            for row in rows
        ])

    expires_in_hours = int(request.data.get('expires_in_hours', 168))
    allow_comments = bool(request.data.get('allow_comments', True))
    pin_code = str(request.data.get('pin_code', '')).strip()
    link = ReviewLink.objects.create(
        session=session,
        token=secrets.token_urlsafe(24),
        created_by=request.user,
        expires_at=timezone.now() + timedelta(hours=expires_in_hours),
        is_active=True,
        allow_comments=allow_comments,
        pin_code_hash=make_password(pin_code) if pin_code else '',
    )
    return Response({
        'id': link.id,
        'session_id': link.session_id,
        'token': link.token,
        'created_by_user_id': link.created_by_id,
        'expires_at': link.expires_at,
        'is_active': link.is_active,
        'allow_comments': link.allow_comments,
        'last_accessed_at': link.last_accessed_at,
    }, status=status.HTTP_201_CREATED)


@csrf_exempt
@ratelimit(key='ip', rate='30/h', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def v1_review_link_verify_pin(request, token):
    link = get_object_or_404(ReviewLink, token=token)
    if not link.is_active or link.expires_at <= timezone.now():
        return Response({'error': 'Link is inactive or expired'}, status=status.HTTP_404_NOT_FOUND)
    if not link.pin_code_hash:
        return Response({'ok': True, 'pin_required': False})
    pin_code = str(request.data.get('pin_code', '')).strip()
    ok = bool(pin_code) and check_password(pin_code, link.pin_code_hash)
    return Response({'ok': ok, 'pin_required': True})


@csrf_exempt
@ratelimit(key='ip', rate='30/h', method='POST', block=True)
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def v1_review_link_feedback(request, token):
    link = get_object_or_404(ReviewLink, token=token)
    if not link.is_active or link.expires_at <= timezone.now():
        return Response({'error': 'Link is inactive or expired'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        rows = ReviewFeedbackSerializer(link.feedback.all().order_by('timestamp_seconds', 'created_at'), many=True)
        return Response(rows.data)
    if not link.allow_comments:
        return Response({'error': 'Comments are disabled for this link'}, status=status.HTTP_403_FORBIDDEN)
    if link.pin_code_hash:
        pin_code = str(request.data.get('pin_code', '')).strip()
        if not check_password(pin_code, link.pin_code_hash):
            return Response({'error': 'Invalid PIN'}, status=status.HTTP_403_FORBIDDEN)
    serializer = ReviewFeedbackSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(review_link=link, session=link.session)
    owner_email = link.session.user.email if link.session.user_id and link.session.user.email else ''
    send_notification(
        subject='New public feedback on Practica session',
        body=f'Public review feedback was posted for "{link.session.title}".',
        recipients=[owner_email] if owner_email else [],
    )
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def v1_review_link_revoke(request, review_link_id):
    link = get_object_or_404(ReviewLink, pk=review_link_id)
    if request.user.id != link.session.user_id and not request.user.is_staff:
        return Response({'error': 'Only owner/admin can revoke review links'}, status=status.HTTP_403_FORBIDDEN)
    link.is_active = False
    link.save(update_fields=['is_active'])
    return Response({'ok': True})


def _analytics_row_for(user, on_date):
    row, _ = AnalyticsDaily.objects.get_or_create(user=user, date=on_date)
    return row


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def v1_analytics_summary(request):
    now = timezone.now()
    week_start = (now - timedelta(days=6)).date()
    sessions_week = Session.objects.filter(user=request.user, created_at__date__gte=week_start).count()
    total_minutes = Session.objects.filter(user=request.user).aggregate(total=Sum('duration_seconds')).get('total') or 0
    comments_received = Comment.objects.filter(session__user=request.user).exclude(user=request.user).count()
    return Response({
        'sessions_this_week': sessions_week,
        'total_minutes_practiced': int(total_minutes // 60),
        'comments_received': comments_received,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def v1_analytics_weekly(request):
    now = timezone.now().date()
    points = []
    for delta in range(6, -1, -1):
        day = now - timedelta(days=delta)
        sessions = Session.objects.filter(user=request.user, created_at__date=day)
        comments_received = Comment.objects.filter(
            session__user=request.user,
            created_at__date=day,
        ).exclude(user=request.user).count()
        duration_sum = sessions.aggregate(total=Sum('duration_seconds')).get('total') or 0
        row = _analytics_row_for(request.user, day)
        row.session_count = sessions.count()
        row.practice_minutes = int(duration_sum // 60)
        row.comments_received = comments_received
        row.save(update_fields=['session_count', 'practice_minutes', 'comments_received', 'updated_at'])
        points.append({
            'date': day.isoformat(),
            'session_count': row.session_count,
            'practice_minutes': row.practice_minutes,
            'comments_received': row.comments_received,
        })
    return Response({'points': points})


@api_view(['GET'])
@permission_classes([AllowAny])
def v1_review_link_public(request, token):
    link = get_object_or_404(ReviewLink, token=token)
    if not link.is_active or link.expires_at <= timezone.now():
        return Response({'error': 'Link is inactive or expired'}, status=status.HTTP_404_NOT_FOUND)
    ReviewLink.objects.filter(pk=link.pk).update(last_accessed_at=timezone.now())
    return Response({
        'session': PublicSessionSerializer(link.session, context={'request': request}).data,
        'link': ReviewLinkSerializer(link, context={'request': request}).data,
    })
