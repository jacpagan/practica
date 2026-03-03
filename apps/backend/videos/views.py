import secrets
import uuid
import math
import logging
from datetime import timedelta
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate
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
    Exercise, Session, Chapter, Comment, InviteCode, SessionLastSeen,
    Tag, Space, SpaceMember, MultipartSessionUpload, ExerciseReferenceClip,
    CoachEvent, CoachDailyMetric,
)
from .serializers import (
    UserSerializer, RegisterSerializer, SpaceSerializer,
    ExerciseSerializer, SessionSerializer, SessionListSerializer,
    ChapterSerializer, ProgressChapterSerializer, TagSerializer,
    ExerciseReferenceClipSerializer,
)

logger = logging.getLogger(__name__)


def _visible_sessions_qs(user):
    """Sessions visible in spaces you belong to/own, plus your own sessions."""
    if not user.is_authenticated:
        return Session.objects.none()
    if user.is_staff:
        return Session.objects.all()
    return Session.objects.filter(
        Q(user=user) |
        Q(space__owner=user) |
        Q(space__members__user=user)
    ).distinct()


def can_post_to_space(user, space):
    if not user.is_authenticated:
        return False
    if user.is_staff or space.owner_id == user.id:
        return True
    return SpaceMember.objects.filter(space=space, user=user).exists()


def can_edit_session(user, session):
    if not user.is_authenticated:
        return False
    return user.is_staff or session.user_id == user.id


def _coach_metrics_enabled():
    return bool(getattr(settings, 'COACH_METRICS_ENABLED', False))


def _coach_metrics_user_allowed(user):
    allowlist = set(getattr(settings, 'COACH_METRICS_INTERNAL_USER_IDS', []))
    return not allowlist or user.is_staff or user.id in allowlist


def record_coach_event(
    *,
    user_id,
    event_type,
    session_id=None,
    space_id=None,
    metadata=None,
):
    try:
        CoachEvent.objects.create(
            user_id=user_id,
            event_type=event_type,
            session_id=session_id,
            space_id=space_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.exception('Failed to persist coach telemetry event: %s', event_type)


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


def _resolve_space_for_create(user, space_id):
    if not space_id:
        return None
    space = get_object_or_404(Space, pk=space_id)
    if not can_post_to_space(user, space):
        raise PermissionDenied("You can only post to spaces you belong to.")
    return space


def _attach_tags_to_session(session, raw_tags):
    for name in _parse_tag_names(raw_tags):
        tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
        session.tags.add(tag)


def _can_view_session(user, session):
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    if session.user_id == user.id:
        return True
    if session.space_id:
        return Space.objects.filter(
            pk=session.space_id
        ).filter(
            Q(owner=user) | Q(members__user=user)
        ).exists()
    return False


def _can_modify_session(user, session):
    return can_edit_session(user, session)


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

    logger.warning(
        'ClientError source=%s path=%s user_id=%s message=%s ua=%s extra=%s stack=%s',
        source or 'unknown',
        path or 'unknown',
        user_id,
        message or 'n/a',
        user_agent or 'n/a',
        extra,
        stack or 'n/a',
    )
    return Response({'ok': True}, status=status.HTTP_202_ACCEPTED)


# ── Tag views ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tag_list(request):
    q = request.query_params.get('q', '').strip()
    tags = Tag.objects.all()
    if q:
        tags = tags.filter(name__icontains=q)
    return Response(TagSerializer(tags[:20], many=True).data)


# ── Space views ─────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class SpaceViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Spaces you own + spaces you follow."""
        user = self.request.user
        owned = Space.objects.filter(owner=user)
        following_ids = SpaceMember.objects.filter(user=user).values_list('space_id', flat=True)
        following = Space.objects.filter(id__in=following_ids)
        return (owned | following).distinct().prefetch_related('members', 'members__user', 'members__user__profile')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _ensure_space_owner(self, space):
        if space.owner_id != self.request.user.id:
            raise PermissionDenied("Only the space owner can modify this space.")

    def perform_update(self, serializer):
        self._ensure_space_owner(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_space_owner(instance)
        instance.delete()

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """Generate an invite code for this space."""
        space = self.get_object()
        if space.owner != request.user:
            return Response({'error': 'Only the space owner can invite'}, status=status.HTTP_403_FORBIDDEN)
        code = secrets.token_hex(4).upper()
        InviteCode.objects.create(code=code, created_by=request.user, space=space)
        return Response({'code': code, 'space': space.name}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='members/(?P<user_id>[0-9]+)')
    def remove_member(self, request, pk=None, user_id=None):
        """Remove a member from this space."""
        space = self.get_object()
        if space.owner != request.user:
            return Response({'error': 'Only the space owner can remove members'}, status=status.HTTP_403_FORBIDDEN)
        deleted = SpaceMember.objects.filter(space=space, user_id=user_id).delete()
        if deleted[0] == 0:
            return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SpaceSerializer(space).data)


@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_space(request, slug):
    """Join a space by its permanent invite slug."""
    try:
        space = Space.objects.get(invite_slug=slug)
    except Space.DoesNotExist:
        return Response({'error': 'Space not found'}, status=status.HTTP_404_NOT_FOUND)

    if space.owner == request.user:
        return Response({'error': 'You own this space'}, status=status.HTTP_400_BAD_REQUEST)

    _, created = SpaceMember.objects.get_or_create(space=space, user=request.user)
    return Response({
        'message': f'Joined {space.name}' if created else f'Already in {space.name}',
        'space': SpaceSerializer(space, context={'request': request}).data,
    })


@csrf_exempt
@api_view(['GET'])
@permission_classes([AllowAny])
def space_info(request, slug):
    """Get basic info about a space from its invite slug (for signup page)."""
    try:
        space = Space.objects.get(invite_slug=slug)
    except Space.DoesNotExist:
        return Response({'error': 'Space not found'}, status=status.HTTP_404_NOT_FOUND)

    owner_name = space.owner.profile.display_name if hasattr(space.owner, 'profile') and space.owner.profile.display_name else space.owner.username
    return Response({
        'name': space.name,
        'owner': owner_name,
        'invite_slug': space.invite_slug,
    })


# ── Invite views (legacy support + space-scoped) ────────────────────

@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_invite(request):
    """Generate a general invite code (for backward compatibility)."""
    space_id = request.data.get('space_id')
    space = None
    if space_id:
        space = get_object_or_404(Space, pk=space_id, owner=request.user)
    code = secrets.token_hex(4).upper()
    InviteCode.objects.create(code=code, created_by=request.user, space=space)
    return Response({'code': code, 'space': space.name if space else None}, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invite(request):
    code = request.data.get('code', '').strip().upper()
    if not code:
        return Response({'error': 'Code required'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            invite = InviteCode.objects.select_for_update().get(code=code, used_by__isnull=True)
        except InviteCode.DoesNotExist:
            return Response({'error': 'Invalid or already used code'}, status=status.HTTP_404_NOT_FOUND)

        if invite.created_by == request.user:
            return Response({'error': 'Cannot use your own invite code'}, status=status.HTTP_400_BAD_REQUEST)

        invite.used_by = request.user
        invite.used_at = timezone.now()
        invite.save()

        if invite.space:
            SpaceMember.objects.get_or_create(space=invite.space, user=request.user)

    return Response({
        'message': 'Linked successfully',
        'space': invite.space.name if invite.space else None,
        'user': UserSerializer(request.user).data,
    })


# ── Exercise views ──────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        exercise = self.get_object()
        visible_qs = _visible_sessions_qs(request.user)
        qs = (
            exercise.chapters
            .select_related('session')
            .filter(session__in=visible_qs)
            .order_by('session__recorded_at')
        )
        serializer = ProgressChapterSerializer(qs, many=True)
        return Response({
            'exercise': ExerciseSerializer(exercise).data,
            'chapters': serializer.data,
        })


# ── Session views ───────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class SessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = _visible_sessions_qs(self.request.user).prefetch_related(
            'chapters', 'chapters__exercise',
            'comments', 'comments__user', 'comments__user__profile',
            'last_seen_by', 'tags',
        ).select_related('user', 'user__profile', 'space')

        space_id = self.request.query_params.get('space')
        if space_id:
            qs = qs.filter(space_id=space_id)

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
        space_id = self.request.data.get('space')
        space = _resolve_space_for_create(self.request.user, space_id)
        session = serializer.save(user=self.request.user, space=space)
        _attach_tags_to_session(session, self.request.data.get('tags', ''))
        transaction.on_commit(
            lambda: record_coach_event(
                user_id=self.request.user.id,
                event_type=CoachEvent.EVENT_SESSION_UPLOADED,
                session_id=session.id,
                space_id=session.space_id,
            )
        )

    def perform_update(self, serializer):
        if not can_edit_session(self.request.user, serializer.instance):
            raise PermissionDenied("You can only edit your own sessions.")
        space_id = self.request.data.get('space')
        space = None
        if space_id:
            space = get_object_or_404(Space, pk=space_id)
            if not can_post_to_space(self.request.user, space):
                raise PermissionDenied("You can only move a session to a space you belong to.")
        elif space_id == '' or (space_id is None and 'space' in self.request.data):
            space = None
        else:
            space = serializer.instance.space
        serializer.save(space=space)

    def perform_destroy(self, instance):
        if not can_edit_session(self.request.user, instance):
            raise PermissionDenied("You can only delete your own sessions.")
        instance.delete()

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
        if content_type and not content_type.startswith('video/'):
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

        try:
            space = _resolve_space_for_create(request.user, request.data.get('space'))
        except PermissionDenied as exc:
            return Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)

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
            space=space,
            status=MultipartSessionUpload.STATUS_INITIATED,
            title=title,
            description=str(request.data.get('description', '')).strip(),
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

            if upload.space_id and not can_post_to_space(request.user, upload.space):
                return Response({'error': 'You can only post to spaces you belong to.'}, status=status.HTTP_403_FORBIDDEN)

            session = Session.objects.create(
                user=request.user,
                space=upload.space,
                title=upload.title,
                description=upload.description,
                video_file=upload.s3_key,
                duration_seconds=upload.duration_seconds,
            )
            _attach_tags_to_session(session, upload.tags_csv)

            upload.status = MultipartSessionUpload.STATUS_COMPLETED
            upload.completed_at = timezone.now()
            upload.session = session
            upload.save(update_fields=['status', 'completed_at', 'session'])
            transaction.on_commit(
                lambda: record_coach_event(
                    user_id=request.user.id,
                    event_type=CoachEvent.EVENT_SESSION_UPLOADED,
                    session_id=session.id,
                    space_id=session.space_id,
                    metadata={'upload_type': 'multipart'},
                )
            )

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

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        session = self.get_object()
        if not _can_view_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'Comment text required'}, status=status.HTTP_400_BAD_REQUEST)
        ts = request.data.get('timestamp_seconds')
        timestamp = None
        if ts is not None and str(ts).strip():
            try:
                timestamp = max(0, int(ts))
            except (ValueError, TypeError):
                pass
        video_file = request.FILES.get('video_reply')
        if video_file and not video_file.content_type.startswith('video/'):
            return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)
        Comment.objects.create(
            session=session, user=request.user,
            timestamp_seconds=timestamp, text=text, video_reply=video_file,
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

    @action(detail=True, methods=['delete'], url_path='comments/(?P<comment_id>[0-9]+)')
    def remove_comment(self, request, pk=None, comment_id=None):
        session = self.get_object()
        if not _can_view_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        comment = get_object_or_404(Comment, pk=comment_id, session=session)
        if request.user != comment.user and not request.user.is_staff:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)


# ── Coach metrics views ────────────────────────────────────────────

def _metric_value(value):
    if value is None:
        return None
    if hasattr(value, 'quantize'):
        return float(value)
    return value


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coach_metrics_summary(request):
    if not _coach_metrics_enabled():
        return Response({'error': 'Coach metrics are disabled'}, status=status.HTTP_404_NOT_FOUND)
    if not _coach_metrics_user_allowed(request.user):
        return Response({'error': 'Coach metrics are disabled'}, status=status.HTTP_404_NOT_FOUND)

    raw_window_days = request.query_params.get('window_days', '30')
    try:
        window_days = int(raw_window_days)
    except (TypeError, ValueError):
        return Response({'error': 'window_days must be 7 or 30'}, status=status.HTTP_400_BAD_REQUEST)
    if window_days not in (7, 30):
        return Response({'error': 'window_days must be 7 or 30'}, status=status.HTTP_400_BAD_REQUEST)

    today = timezone.now().date()
    latest_metric = (
        CoachDailyMetric.objects
        .filter(coach=request.user, date__lte=today)
        .order_by('-date')
        .first()
    )

    metric_rows = []
    if latest_metric:
        trend_start = latest_metric.date - timedelta(days=window_days - 1)
        metric_rows = list(
            CoachDailyMetric.objects.filter(
                coach=request.user,
                date__gte=trend_start,
                date__lte=latest_metric.date,
            ).order_by('date')
        )

    summary = {
        'active_students_30d': latest_metric.active_students_30d if latest_metric else 0,
        'coach_comments_7d': latest_metric.coach_comments_7d if latest_metric else 0,
        'coach_comments_30d': latest_metric.coach_comments_30d if latest_metric else 0,
        'median_time_to_first_coach_comment_hours_30d': _metric_value(
            latest_metric.median_time_to_first_coach_comment_hours_30d if latest_metric else None
        ),
        'estimated_time_saved_hours_30d': _metric_value(
            latest_metric.estimated_time_saved_hours_30d if latest_metric else 0
        ),
    }

    response = {
        'coach_user_id': request.user.id,
        'window_days': window_days,
        'generated_at': timezone.now().isoformat(),
        'summary': summary,
        'trends': {
            'active_students_30d': [{'date': str(m.date), 'value': m.active_students_30d} for m in metric_rows],
            'coach_comments_7d': [{'date': str(m.date), 'value': m.coach_comments_7d} for m in metric_rows],
            'coach_comments_30d': [{'date': str(m.date), 'value': m.coach_comments_30d} for m in metric_rows],
            'median_time_to_first_coach_comment_hours_30d': [
                {'date': str(m.date), 'value': _metric_value(m.median_time_to_first_coach_comment_hours_30d)}
                for m in metric_rows
            ],
            'estimated_time_saved_hours_30d': [
                {'date': str(m.date), 'value': _metric_value(m.estimated_time_saved_hours_30d)}
                for m in metric_rows
            ],
        },
        'definitions': {
            'coach_identity': 'User who owns one or more spaces.',
            'active_students_30d': 'Distinct non-owner users who uploaded sessions in coach-owned spaces.',
            'coach_comments_7d': 'Comments authored by this coach on student sessions in coach-owned spaces.',
            'coach_comments_30d': 'Comments authored by this coach on student sessions in coach-owned spaces over 30 days.',
            'median_time_to_first_coach_comment_hours_30d': 'Median hours from student session upload to first coach comment.',
            'estimated_time_saved_hours_30d': 'coach_comments_30d * minutes_saved_per_comment / 60.',
        },
    }
    return Response(response)


# ── Health check ────────────────────────────────────────────────────

def health_check(request):
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {},
        'version': '3.0.0',
        'environment': 'development' if settings.DEBUG else 'production',
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
