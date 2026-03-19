import secrets
import uuid
import math
import logging
import os
from datetime import timedelta
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponse, Http404
from django.db import connection, transaction
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .models import (
    Session, Chapter, VideoFeedback, SessionLastSeen, Exercise,
    Tag, MultipartSessionUpload, SessionAsset,
    ReviewLink,
)
from .serializers import (
    UserSerializer, RegisterSerializer,
    SessionSerializer, SessionListSerializer,
    ChapterSerializer,
    PublicSessionSerializer, ReviewLinkSerializer, ReviewVideoFeedbackSerializer,
)
from .services.media_pipeline import enqueue_session_processing, enqueue_local_session_transcode, apply_processing_update

logger = logging.getLogger(__name__)


def _visible_sessions_qs(user):
    """Private library sessions for the authenticated user."""
    if not user.is_authenticated:
        return Session.objects.none()
    return Session.objects.filter(user=user)


def can_edit_session(user, session):
    if not user.is_authenticated:
        return False
    return user.is_staff or session.user_id == user.id


def _direct_uploads_enabled():
    return bool(getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''))


def _s3_client():
    return boto3.client(
        's3',
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
    )


def _recommended_part_size(size_bytes):
    min_part_size = 5 * 1024 * 1024
    max_parts = 10000
    part_size = max(min_part_size, math.ceil(size_bytes / max_parts))
    part_size_mb = math.ceil(part_size / (1024 * 1024))
    return part_size_mb * 1024 * 1024


def _sanitize_filename(name):
    safe = (name or 'session-video.mp4').strip().replace('\\', '/').split('/')[-1]
    return safe or 'session-video.mp4'


def _list_uploaded_parts(upload, client=None):
    client = client or _s3_client()
    parts = []
    marker = None
    while True:
        params = {
            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
            'Key': upload.s3_key,
            'UploadId': upload.s3_upload_id,
            'MaxParts': 1000,
        }
        if marker:
            params['PartNumberMarker'] = marker
        resp = client.list_parts(**params)
        for part in resp.get('Parts', []):
            parts.append({
                'part_number': part.get('PartNumber'),
                'etag': str(part.get('ETag', '')).strip(),
                'size': part.get('Size'),
            })
        if not resp.get('IsTruncated'):
            break
        marker = resp.get('NextPartNumberMarker')
        if not marker:
            break
    return parts


def _parse_tag_names(raw_tags):
    if isinstance(raw_tags, str):
        return [t.strip() for t in raw_tags.split(',') if t.strip()]
    if isinstance(raw_tags, list):
        return [str(t).strip() for t in raw_tags if str(t).strip()]
    return []


def _filename_has_video_extension(filename):
    name = str(filename or '').strip().lower()
    return name.endswith(('.mov', '.mp4', '.m4v', '.webm', '.avi', '.mkv', '.mpeg', '.mpg', '.wmv', '.3gp'))


def _is_allowed_video_upload(content_type, filename=''):
    normalized_type = str(content_type or '').strip().lower()
    if normalized_type.startswith('video/'):
        return True
    if normalized_type in {'application/octet-stream', 'binary/octet-stream', ''} and _filename_has_video_extension(filename):
        return True
    return False


def _attach_tags_to_session(session, raw_tags):
    for name in _parse_tag_names(raw_tags):
        tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
        session.tags.add(tag)


def _can_view_session(user, session):
    if not user.is_authenticated:
        return False
    return user.is_staff or session.user_id == user.id


def _can_modify_session(user, session):
    return can_edit_session(user, session)


def _browser_playable_source(filename):
    name = str(filename or '').strip().lower()
    return name.endswith(('.mp4', '.m4v'))


def _fallback_content_type(filename):
    return 'video/mp4'


def _start_processing_pipeline(session):
    session.processing_status = Session.STATUS_PROCESSING
    session.processing_error = ''
    session.save(update_fields=['processing_status', 'processing_error', 'updated_at'])

    queued, error, _job_id = enqueue_session_processing(session)
    if queued:
        return

    # Fallback when managed transcoding is unavailable.
    if 'not configured' in error.lower():
        if _browser_playable_source(session.video_file.name):
            SessionAsset.objects.get_or_create(
                session=session,
                asset_type=SessionAsset.TYPE_PROXY_MP4,
                defaults={
                    'object_key': session.video_file.name,
                    'content_type': _fallback_content_type(session.video_file.name),
                    'metadata_json': {'source': 'original'},
                },
            )
            session.processing_status = Session.STATUS_READY
            session.processing_error = ''
        else:
            queued_local, local_error = enqueue_local_session_transcode(session)
            if queued_local:
                return
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = (
                'Upload finished, but browser playback needs transcoding for this file type. '
                f'Local transcoding is unavailable: {local_error or "ffmpeg missing"}. '
                'Please upload MP4 or enable AWS MediaConvert/local ffmpeg playback conversion.'
            )
    else:
        session.processing_status = Session.STATUS_FAILED
        session.processing_error = (error or 'Failed to enqueue media processing')[:2000]
    session.save(update_fields=['processing_status', 'processing_error', 'updated_at'])


def _processing_callback_authorized(request):
    shared_token = (getattr(settings, 'MEDIA_PROCESSING_CALLBACK_TOKEN', '') or '').strip()
    if shared_token:
        provided = str(request.headers.get('X-Processing-Token', '')).strip()
        return provided and secrets.compare_digest(provided, shared_token)
    return bool(request.user.is_authenticated and request.user.is_staff)


# ── Auth views ──────────────────────────────────────────────────────

@csrf_exempt
@ratelimit(key='ip', rate='5/h', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
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


@csrf_exempt
@ratelimit(key='ip', rate='30/m', method='POST', block=True)
@api_view(['POST'])
@permission_classes([AllowAny])
def client_error_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    message = str(payload.get('message', '')).strip()[:1000]
    stack = str(payload.get('stack', '')).strip()[:6000]
    source = str(payload.get('source', '')).strip()[:64]
    path = str(payload.get('path', '')).strip()[:512]
    extra = payload.get('extra') if isinstance(payload.get('extra'), dict) else {}
    user_id = request.user.id if getattr(request.user, 'is_authenticated', False) else None
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:512]

    request_id = request.META.get('HTTP_X_REQUEST_ID', '')
    logger.warning(
        'ClientError source=%s path=%s user_id=%s request_id=%s message=%s ua=%s extra=%s stack=%s',
        source or 'unknown',
        path or 'unknown',
        user_id,
        request_id,
        message or 'n/a',
        user_agent or 'n/a',
        extra,
        stack or 'n/a',
    )
    return Response({'ok': True}, status=status.HTTP_202_ACCEPTED)


# ── Legacy product surfaces removed ─────────────────────────────────


@csrf_exempt
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def review_link_info(request, token):
    link = _active_review_link_or_404(token)
    ReviewLink.objects.filter(pk=link.pk).update(last_accessed_at=timezone.now())
    link.refresh_from_db(fields=['last_accessed_at'])
    return Response({
        'session': PublicSessionSerializer(link.session, context={'request': request}).data,
        'link': ReviewLinkSerializer(link, context={'request': request}).data,
    })


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def review_link_feedback(request, token):
    link = _active_review_link_or_404(token)

    if request.method == 'GET':
        feedback = link.session.video_feedback.select_related('user', 'user__profile').order_by('timestamp_seconds', 'created_at')
        return Response(ReviewVideoFeedbackSerializer(feedback, many=True, context={'request': request, 'session': link.session}).data)

    if not link.allow_video_feedback:
        return Response({'error': 'Video feedback is disabled for this link'}, status=status.HTTP_403_FORBIDDEN)

    serializer = ReviewVideoFeedbackSerializer(data=request.data, context={'request': request, 'session': link.session})
    serializer.is_valid(raise_exception=True)
    video_file = request.FILES.get('feedback_video')
    if not video_file:
        return Response({'error': 'Feedback video is required'}, status=status.HTTP_400_BAD_REQUEST)
    if video_file and not str(video_file.content_type or '').startswith('video/'):
        return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)

    item = VideoFeedback.objects.create(
        session=link.session,
        user=request.user,
        timestamp_seconds=serializer.validated_data.get('timestamp_seconds'),
        text=str(serializer.validated_data.get('text', '')).strip(),
        feedback_video=video_file,
        is_legacy_text_feedback=False,
    )
    return Response(
        ReviewVideoFeedbackSerializer(item, context={'request': request, 'session': link.session}).data,
        status=status.HTTP_201_CREATED,
    )


# ── Session views ───────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = _visible_sessions_qs(self.request.user).prefetch_related(
            'chapters', 'chapters__exercise',
            'video_feedback', 'video_feedback__user', 'video_feedback__user__profile',
            'last_seen_by', 'tags', 'assets',
        ).select_related('user', 'user__profile')

        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__name__iexact=tag)

        return qs.distinct()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_serializer_class(self):
        if self.action == 'list':
            return SessionListSerializer
        return SessionSerializer

    def perform_create(self, serializer):
        session = serializer.save(user=self.request.user)
        _attach_tags_to_session(session, self.request.data.get('tags', ''))
        _start_processing_pipeline(session)

    def perform_update(self, serializer):
        if not can_edit_session(self.request.user, serializer.instance):
            raise PermissionDenied("You can only edit your own sessions.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_edit_session(self.request.user, instance):
            raise PermissionDenied("You can only delete your own sessions.")
        instance.delete()

    @action(detail=True, methods=['post'], url_path='share')
    def create_share_link(self, request, pk=None):
        session = self.get_object()
        if not can_edit_session(request.user, session):
            raise PermissionDenied("You can only share your own sessions.")
        existing_link = session.review_links.filter(is_active=True, expires_at__gt=timezone.now()).order_by('-created_at').first()
        if existing_link:
            return Response(ReviewLinkSerializer(existing_link, context={'request': request}).data, status=status.HTTP_200_OK)
        expires_at = timezone.now() + timedelta(days=7)
        token = secrets.token_urlsafe(16)
        link = ReviewLink.objects.create(
            session=session,
            token=token,
            created_by=request.user,
            expires_at=expires_at,
            is_active=True,
            allow_video_feedback=True,
        )
        return Response(ReviewLinkSerializer(link, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='share/revoke')
    def revoke_share_link(self, request, pk=None):
        session = self.get_object()
        if not can_edit_session(request.user, session):
            raise PermissionDenied("You can only revoke your own sessions' links.")
        ReviewLink.objects.filter(session=session, is_active=True).update(is_active=False)
        return Response({'ok': True})

    @action(detail=True, methods=['post'], url_path='retry-processing')
    def retry_processing(self, request, pk=None):
        session = self.get_object()
        if not can_edit_session(request.user, session):
            raise PermissionDenied("You can only reprocess your own sessions.")

        session.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4).delete()
        _start_processing_pipeline(session)
        session.refresh_from_db()
        serializer = self.get_serializer(session)
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], url_path='multipart/initiate')
    def multipart_initiate(self, request):
        if not _direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        title = str(request.data.get('title', '')).strip()
        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            size_bytes = int(request.data.get('size_bytes', 0))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid file size'}, status=status.HTTP_400_BAD_REQUEST)
        if size_bytes <= 0:
            return Response({'error': 'Invalid file size'}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = int(getattr(settings, 'UPLOAD_MAX_BYTES', 2147483648))
        if size_bytes > max_bytes:
            return Response({'error': 'File exceeds max upload size (2GB)'}, status=status.HTTP_400_BAD_REQUEST)

        content_type = str(request.data.get('content_type', '')).strip().lower()
        if not _is_allowed_video_upload(content_type, request.data.get('filename')):
            return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)

        filename = _sanitize_filename(request.data.get('filename'))
        key = f"sessions/{request.user.id}/{uuid.uuid4().hex}-{filename}"
        part_size = _recommended_part_size(size_bytes)
        total_parts = math.ceil(size_bytes / part_size)

        try:
            duration_seconds = request.data.get('duration_seconds')
            duration_seconds = int(duration_seconds) if str(duration_seconds).strip() else None
        except (TypeError, ValueError):
            return Response({'error': 'Invalid duration'}, status=status.HTTP_400_BAD_REQUEST)

        tags_csv = ','.join(_parse_tag_names(request.data.get('tags', [])))
        expires_at = timezone.now() + timedelta(hours=24)

        try:
            create_kwargs = {
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                'Key': key,
            }
            if content_type:
                create_kwargs['ContentType'] = content_type
            resp = _s3_client().create_multipart_upload(**create_kwargs)
        except (BotoCoreError, ClientError):
            return Response({'error': 'Could not start multipart upload'}, status=status.HTTP_502_BAD_GATEWAY)

        upload = MultipartSessionUpload.objects.create(
            user=request.user,
            status=MultipartSessionUpload.STATUS_INITIATED,
            title=title,
            description=str(request.data.get('description', '')).strip(),
            reference_title=str(request.data.get('reference_title', '')).strip(),
            reference_url=str(request.data.get('reference_url', '')).strip(),
            tags_csv=tags_csv,
            duration_seconds=duration_seconds,
            original_filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            s3_key=key,
            s3_upload_id=resp['UploadId'],
            expires_at=expires_at,
        )

        return Response({
            'multipart_upload_id': upload.id,
            'part_size': part_size,
            'total_parts': total_parts,
            'expires_at': upload.expires_at,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='multipart/status')
    def multipart_status(self, request):
        if not _direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload'}, status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status == MultipartSessionUpload.STATUS_INITIATED and upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])

        part_size = _recommended_part_size(upload.size_bytes)
        total_parts = math.ceil(upload.size_bytes / part_size)
        uploaded_parts = []

        if upload.status == MultipartSessionUpload.STATUS_INITIATED:
            try:
                uploaded_parts = _list_uploaded_parts(upload)
            except ClientError as exc:
                code = str(exc.response.get('Error', {}).get('Code', ''))
                if code == 'NoSuchUpload':
                    upload.status = MultipartSessionUpload.STATUS_EXPIRED
                    upload.save(update_fields=['status'])
                    return Response({'error': 'Upload session no longer exists'}, status=status.HTTP_410_GONE)
                return Response({'error': 'Could not fetch multipart upload status'}, status=status.HTTP_502_BAD_GATEWAY)
            except BotoCoreError:
                return Response({'error': 'Could not fetch multipart upload status'}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'multipart_upload_id': upload.id,
            'status': upload.status,
            'expires_at': upload.expires_at,
            'size_bytes': upload.size_bytes,
            'part_size': part_size,
            'total_parts': total_parts,
            'uploaded_parts': uploaded_parts,
        })

    @action(detail=False, methods=['post'], url_path='multipart/sign-part')
    def multipart_sign_part(self, request):
        if not _direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
            part_number = int(request.data.get('part_number'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload or part number'}, status=status.HTTP_400_BAD_REQUEST)
        if part_number <= 0:
            return Response({'error': 'Part number must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status != MultipartSessionUpload.STATUS_INITIATED:
            return Response({'error': 'Upload is not open'}, status=status.HTTP_400_BAD_REQUEST)
        if upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])
            return Response({'error': 'Upload has expired'}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({'error': 'Could not sign upload part'}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({'signed_url': signed_url})

    @action(detail=False, methods=['post'], url_path='multipart/complete')
    def multipart_complete(self, request):
        if not _direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload'}, status=status.HTTP_400_BAD_REQUEST)

        raw_parts = request.data.get('parts', [])
        if not isinstance(raw_parts, list) or not raw_parts:
            return Response({'error': 'Parts are required'}, status=status.HTTP_400_BAD_REQUEST)

        parts = []
        for part in raw_parts:
            if not isinstance(part, dict):
                return Response({'error': 'Invalid part payload'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                part_number = int(part.get('part_number'))
            except (TypeError, ValueError):
                return Response({'error': 'Invalid part number'}, status=status.HTTP_400_BAD_REQUEST)
            etag = str(part.get('etag', '')).strip()
            if part_number <= 0 or not etag:
                return Response({'error': 'Each part needs part_number and etag'}, status=status.HTTP_400_BAD_REQUEST)
            parts.append({'PartNumber': part_number, 'ETag': etag})

        parts = sorted(parts, key=lambda p: p['PartNumber'])

        with transaction.atomic():
            upload = get_object_or_404(
                MultipartSessionUpload.objects.select_for_update(),
                pk=upload_id,
                user=request.user,
            )
            if upload.status != MultipartSessionUpload.STATUS_INITIATED:
                return Response({'error': 'Upload is not open'}, status=status.HTTP_400_BAD_REQUEST)
            if upload.expires_at < timezone.now():
                upload.status = MultipartSessionUpload.STATUS_EXPIRED
                upload.save(update_fields=['status'])
                return Response({'error': 'Upload has expired'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                _s3_client().complete_multipart_upload(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=upload.s3_key,
                    UploadId=upload.s3_upload_id,
                    MultipartUpload={'Parts': parts},
                )
            except (BotoCoreError, ClientError):
                return Response({'error': 'Could not finalize multipart upload'}, status=status.HTTP_502_BAD_GATEWAY)

            session = Session.objects.create(
                user=request.user,
                title=upload.title,
                description=upload.description,
                reference_title=upload.reference_title,
                reference_url=upload.reference_url,
                video_file=upload.s3_key,
                duration_seconds=upload.duration_seconds,
            )
            _attach_tags_to_session(session, upload.tags_csv)

            upload.status = MultipartSessionUpload.STATUS_COMPLETED
            upload.completed_at = timezone.now()
            upload.session = session
            upload.save(update_fields=['status', 'completed_at', 'session'])

        _start_processing_pipeline(session)

        serializer = SessionSerializer(session, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='multipart/abort')
    def multipart_abort(self, request):
        if not _direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload'}, status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status != MultipartSessionUpload.STATUS_INITIATED:
            return Response({'status': upload.status})

        try:
            _s3_client().abort_multipart_upload(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=upload.s3_key,
                UploadId=upload.s3_upload_id,
            )
        except (BotoCoreError, ClientError):
            # Treat as best effort; upload can still be marked aborted locally.
            pass

        upload.status = MultipartSessionUpload.STATUS_ABORTED
        upload.save(update_fields=['status'])
        return Response({'status': 'aborted'})

    @action(detail=True, methods=['post'], url_path='processing-update', permission_classes=[AllowAny])
    def processing_update(self, request, pk=None):
        if not _processing_callback_authorized(request):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(Session, pk=pk)
        next_status = str(request.data.get('status', '')).strip().lower()
        processing_error = str(request.data.get('processing_error', '')).strip()
        assets = request.data.get('assets', [])
        if not isinstance(assets, list):
            return Response({'error': 'assets must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            apply_processing_update(
                session=session,
                status=next_status,
                error=processing_error,
                assets=assets,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('Failed processing update for session_id=%s', session.id)
            return Response({'error': 'Could not apply processing update'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(SessionSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def set_tags(self, request, pk=None):
        session = self.get_object()
        if not _can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        tag_names = request.data.get('tags', [])
        if isinstance(tag_names, str):
            tag_names = [t.strip() for t in tag_names.split(',') if t.strip()]
        session.tags.clear()
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
            session.tags.add(tag)
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def add_chapter(self, request, pk=None):
        session = self.get_object()
        if not _can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        exercise_name = request.data.get('exercise_name', '').strip()
        exercise_id = request.data.get('exercise')
        exercise = None
        if exercise_id:
            exercise = get_object_or_404(Exercise, pk=exercise_id)
        elif exercise_name:
            exercise, _ = Exercise.objects.get_or_create(name__iexact=exercise_name, defaults={'name': exercise_name})
        ts = request.data.get('timestamp_seconds', 0)
        end = request.data.get('end_seconds')
        try:
            ts = max(0, int(ts))
        except (ValueError, TypeError):
            ts = 0
        if end is not None and str(end).strip():
            try:
                end = int(end)
                if end <= ts:
                    return Response({'error': 'End time must be after start time'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                end = None
        else:
            end = None
        serializer = ChapterSerializer(data={
            'session': session.id, 'exercise': exercise.id if exercise else None,
            'title': request.data.get('title', ''), 'timestamp_seconds': ts,
            'end_seconds': end, 'notes': request.data.get('notes', ''),
        })
        if serializer.is_valid():
            serializer.save()
            session.refresh_from_db()
            return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='chapters/(?P<chapter_id>[0-9]+)/update')
    def update_chapter(self, request, pk=None, chapter_id=None):
        session = self.get_object()
        if not _can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        chapter = get_object_or_404(Chapter, pk=chapter_id, session=session)

        exercise_name = request.data.get('exercise_name', '').strip()
        if exercise_name:
            exercise, _ = Exercise.objects.get_or_create(name__iexact=exercise_name, defaults={'name': exercise_name})
            chapter.exercise = exercise

        if 'notes' in request.data:
            chapter.notes = request.data['notes'].strip()
        if 'timestamp_seconds' in request.data:
            try:
                chapter.timestamp_seconds = max(0, int(request.data['timestamp_seconds']))
            except (ValueError, TypeError):
                pass
        if 'end_seconds' in request.data:
            end = request.data['end_seconds']
            if end is not None and str(end).strip():
                try:
                    end = int(end)
                    if end > chapter.timestamp_seconds:
                        chapter.end_seconds = end
                except (ValueError, TypeError):
                    pass
            else:
                chapter.end_seconds = None

        chapter.save()
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['delete'], url_path='chapters/(?P<chapter_id>[0-9]+)')
    def remove_chapter(self, request, pk=None, chapter_id=None):
        session = self.get_object()
        if not _can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        chapter = get_object_or_404(Chapter, pk=chapter_id, session=session)
        chapter.delete()
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['post'], url_path='video-feedback')
    def add_video_feedback(self, request, pk=None):
        session = self.get_object()
        if not _can_view_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        text = str(request.data.get('text', '')).strip()
        ts = request.data.get('timestamp_seconds')
        timestamp = None
        if ts is not None and str(ts).strip():
            try:
                timestamp = max(0, int(ts))
            except (ValueError, TypeError):
                pass
        video_file = request.FILES.get('feedback_video')
        if not video_file:
            return Response({'error': 'Feedback video is required'}, status=status.HTTP_400_BAD_REQUEST)
        if video_file and not video_file.content_type.startswith('video/'):
            return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)
        VideoFeedback.objects.create(
            session=session, user=request.user,
            timestamp_seconds=timestamp, text=text, feedback_video=video_file, is_legacy_text_feedback=False,
        )
        session.refresh_from_db()
        return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_seen(self, request, pk=None):
        session = self.get_object()
        SessionLastSeen.objects.update_or_create(
            user=request.user, session=session,
            defaults={'seen_at': timezone.now()},
        )
        return Response({'status': 'ok'})

    @action(detail=True, methods=['delete'], url_path='video-feedback/(?P<feedback_id>[0-9]+)')
    def remove_video_feedback(self, request, pk=None, feedback_id=None):
        session = self.get_object()
        if not _can_view_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        feedback = get_object_or_404(VideoFeedback, pk=feedback_id, session=session)
        if request.user != feedback.user and not request.user.is_staff:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        feedback.delete()
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)
# ── Health check ────────────────────────────────────────────────────

def health_check(request):
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {},
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
