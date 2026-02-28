import secrets
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

from .models import (
    Exercise, Session, Chapter, Comment, InviteCode, SessionLastSeen,
    Tag, Space, SpaceMember, FeedbackRequest, FeedbackAssignment,
)
from .serializers import (
    UserSerializer, RegisterSerializer, SpaceSerializer,
    ExerciseSerializer, SessionSerializer, SessionListSerializer,
    ChapterSerializer, ProgressChapterSerializer, TagSerializer,
    FeedbackRequestSerializer, FeedbackAssignmentSerializer,
)


def _visible_sessions_qs(user):
    """Sessions visible in spaces you belong to/own, plus your own sessions."""
    if not user.is_authenticated:
        return Session.objects.none()
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


def can_review_request(user, feedback_request):
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    if feedback_request.requester_id == user.id:
        return False
    return can_post_to_space(user, feedback_request.space)


def _expire_overdue_feedback_requests(now=None):
    now = now or timezone.now()
    overdue_qs = FeedbackRequest.objects.filter(
        status=FeedbackRequest.STATUS_OPEN,
        due_at__lt=now,
    )
    overdue_ids = list(overdue_qs.values_list('id', flat=True))
    if overdue_ids:
        overdue_qs.update(status=FeedbackRequest.STATUS_EXPIRED, resolved_at=now)
        FeedbackAssignment.objects.filter(
            feedback_request_id__in=overdue_ids,
            status=FeedbackAssignment.STATUS_CLAIMED,
        ).update(status=FeedbackAssignment.STATUS_EXPIRED)
    return len(overdue_ids)


def _refresh_feedback_request_status(feedback_request):
    completed_count = feedback_request.assignments.filter(
        status=FeedbackAssignment.STATUS_COMPLETED
    ).count()
    video_count = feedback_request.assignments.filter(
        status=FeedbackAssignment.STATUS_COMPLETED,
        is_video_review=True,
    ).count()
    if (
        feedback_request.status == FeedbackRequest.STATUS_OPEN
        and completed_count >= feedback_request.required_reviews
        and video_count >= feedback_request.video_required_count
    ):
        feedback_request.status = FeedbackRequest.STATUS_FULFILLED
        feedback_request.resolved_at = timezone.now()
        feedback_request.save(update_fields=['status', 'resolved_at'])


def _feedback_requests_enabled():
    return bool(getattr(settings, 'FEEDBACK_REQUESTS_ENABLED', False))


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
            'feedback_requests', 'feedback_requests__assignments',
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
        space = None
        if space_id:
            space = get_object_or_404(Space, pk=space_id)
            if not can_post_to_space(self.request.user, space):
                raise PermissionDenied("You can only post to spaces you belong to.")

        session = serializer.save(user=self.request.user, space=space)

        tag_names = self.request.data.get('tags', '')
        if isinstance(tag_names, str):
            tag_names = [t.strip() for t in tag_names.split(',') if t.strip()]
        elif isinstance(tag_names, list):
            tag_names = [t.strip() for t in tag_names if t.strip()]
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
            session.tags.add(tag)

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

    @action(detail=True, methods=['post'], url_path='feedback-request')
    def create_feedback_request(self, request, pk=None):
        if not _feedback_requests_enabled():
            return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

        _expire_overdue_feedback_requests()
        session = self.get_object()
        if not can_edit_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if not session.space_id:
            return Response({'error': 'Session must belong to a space'}, status=status.HTTP_400_BAD_REQUEST)

        focus_prompt = request.data.get('focus_prompt', '').strip()
        if not focus_prompt:
            return Response({'error': 'Focus prompt is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sla_hours = int(request.data.get('sla_hours', 48))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid SLA value'}, status=status.HTTP_400_BAD_REQUEST)
        if sla_hours <= 0:
            return Response({'error': 'SLA must be greater than 0 hours'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            required_reviews = int(request.data.get('required_reviews', 1))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid required reviews value'}, status=status.HTTP_400_BAD_REQUEST)
        if required_reviews <= 0:
            return Response({'error': 'Required reviews must be at least 1'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            video_required_count = int(request.data.get('video_required_count', 1))
        except (ValueError, TypeError):
            return Response({'error': 'Invalid video-required value'}, status=status.HTTP_400_BAD_REQUEST)
        if video_required_count < 0:
            return Response({'error': 'Video-required count cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
        if video_required_count > required_reviews:
            return Response(
                {'error': 'Video-required count cannot exceed required reviews'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        feedback_request = FeedbackRequest.objects.create(
            session=session,
            requester=request.user,
            space=session.space,
            status=FeedbackRequest.STATUS_OPEN,
            sla_hours=sla_hours,
            due_at=timezone.now() + timedelta(hours=sla_hours),
            required_reviews=required_reviews,
            video_required_count=video_required_count,
            focus_prompt=focus_prompt,
        )
        serializer = FeedbackRequestSerializer(feedback_request, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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


# ── Feedback request views ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_requests_open(request):
    if not _feedback_requests_enabled():
        return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

    _expire_overdue_feedback_requests()

    qs = (
        FeedbackRequest.objects
        .filter(status=FeedbackRequest.STATUS_OPEN)
        .filter(Q(space__owner=request.user) | Q(space__members__user=request.user))
        .select_related('session', 'space', 'requester', 'requester__profile')
        .prefetch_related('assignments')
        .order_by('due_at', 'created_at')
        .distinct()
    )
    session_id = request.query_params.get('session')
    if session_id:
        qs = qs.filter(session_id=session_id)

    serializer = FeedbackRequestSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_requests_assigned(request):
    if not _feedback_requests_enabled():
        return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

    _expire_overdue_feedback_requests()

    qs = (
        FeedbackAssignment.objects
        .filter(
            reviewer=request.user,
            status=FeedbackAssignment.STATUS_CLAIMED,
            feedback_request__status=FeedbackRequest.STATUS_OPEN,
        )
        .select_related(
            'reviewer', 'reviewer__profile',
            'feedback_request', 'feedback_request__session',
            'feedback_request__space', 'feedback_request__requester',
            'feedback_request__requester__profile',
        )
        .prefetch_related('feedback_request__assignments')
        .order_by('feedback_request__due_at', '-claimed_at')
    )
    serializer = FeedbackAssignmentSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def feedback_request_claim(request, request_id):
    if not _feedback_requests_enabled():
        return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

    _expire_overdue_feedback_requests()

    with transaction.atomic():
        feedback_request = get_object_or_404(
            FeedbackRequest.objects.select_for_update().select_related('space'),
            pk=request_id,
        )
        if feedback_request.status != FeedbackRequest.STATUS_OPEN:
            return Response({'error': 'Request is not open'}, status=status.HTTP_400_BAD_REQUEST)
        if feedback_request.due_at < timezone.now():
            feedback_request.status = FeedbackRequest.STATUS_EXPIRED
            feedback_request.resolved_at = timezone.now()
            feedback_request.save(update_fields=['status', 'resolved_at'])
            return Response({'error': 'Request has expired'}, status=status.HTTP_400_BAD_REQUEST)
        if not can_review_request(request.user, feedback_request):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        existing = FeedbackAssignment.objects.select_for_update().filter(
            feedback_request=feedback_request,
            reviewer=request.user,
        ).first()
        if existing and existing.status == FeedbackAssignment.STATUS_CLAIMED:
            serializer = FeedbackAssignmentSerializer(existing, context={'request': request})
            return Response(serializer.data)
        if existing and existing.status == FeedbackAssignment.STATUS_COMPLETED:
            return Response({'error': 'You already completed this request'}, status=status.HTTP_400_BAD_REQUEST)

        claimed_count = FeedbackAssignment.objects.filter(
            feedback_request=feedback_request,
            status=FeedbackAssignment.STATUS_CLAIMED,
        ).count()
        if claimed_count >= feedback_request.required_reviews:
            return Response({'error': 'All review slots are already claimed'}, status=status.HTTP_409_CONFLICT)

        if existing:
            existing.status = FeedbackAssignment.STATUS_CLAIMED
            existing.claimed_at = timezone.now()
            existing.completed_at = None
            existing.is_video_review = False
            existing.comment = None
            existing.save(update_fields=['status', 'claimed_at', 'completed_at', 'is_video_review', 'comment'])
            assignment = existing
        else:
            assignment = FeedbackAssignment.objects.create(
                feedback_request=feedback_request,
                reviewer=request.user,
                status=FeedbackAssignment.STATUS_CLAIMED,
            )

    serializer = FeedbackAssignmentSerializer(assignment, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def feedback_request_release(request, request_id):
    if not _feedback_requests_enabled():
        return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

    _expire_overdue_feedback_requests()
    feedback_request = get_object_or_404(FeedbackRequest, pk=request_id)
    assignment = get_object_or_404(
        FeedbackAssignment,
        feedback_request=feedback_request,
        reviewer=request.user,
    )
    if assignment.status != FeedbackAssignment.STATUS_CLAIMED:
        return Response({'error': 'Only claimed assignments can be released'}, status=status.HTTP_400_BAD_REQUEST)
    assignment.status = FeedbackAssignment.STATUS_RELEASED
    assignment.save(update_fields=['status'])
    serializer = FeedbackAssignmentSerializer(assignment, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def feedback_request_cancel(request, request_id):
    if not _feedback_requests_enabled():
        return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

    _expire_overdue_feedback_requests()
    with transaction.atomic():
        feedback_request = get_object_or_404(FeedbackRequest.objects.select_for_update(), pk=request_id)
        if feedback_request.requester_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if feedback_request.status != FeedbackRequest.STATUS_OPEN:
            return Response({'error': 'Only open requests can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)

        feedback_request.status = FeedbackRequest.STATUS_CANCELLED
        feedback_request.resolved_at = timezone.now()
        feedback_request.save(update_fields=['status', 'resolved_at'])
        FeedbackAssignment.objects.filter(
            feedback_request=feedback_request,
            status=FeedbackAssignment.STATUS_CLAIMED,
        ).update(status=FeedbackAssignment.STATUS_RELEASED)

    serializer = FeedbackRequestSerializer(feedback_request, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def feedback_request_complete(request, request_id):
    if not _feedback_requests_enabled():
        return Response({'error': 'Feedback requests are disabled'}, status=status.HTTP_404_NOT_FOUND)

    _expire_overdue_feedback_requests()

    with transaction.atomic():
        feedback_request = get_object_or_404(
            FeedbackRequest.objects.select_for_update().select_related('session', 'space'),
            pk=request_id,
        )
        if feedback_request.status != FeedbackRequest.STATUS_OPEN:
            return Response({'error': 'Request is not open'}, status=status.HTTP_400_BAD_REQUEST)
        if not can_review_request(request.user, feedback_request):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        assignment = FeedbackAssignment.objects.select_for_update().filter(
            feedback_request=feedback_request,
            reviewer=request.user,
        ).first()
        if not assignment or assignment.status != FeedbackAssignment.STATUS_CLAIMED:
            return Response({'error': 'You must claim this request first'}, status=status.HTTP_400_BAD_REQUEST)

        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'Comment text required'}, status=status.HTTP_400_BAD_REQUEST)

        ts = request.data.get('timestamp_seconds')
        timestamp = None
        if ts is not None and str(ts).strip():
            try:
                timestamp = max(0, int(ts))
            except (ValueError, TypeError):
                timestamp = None

        video_file = request.FILES.get('video_reply')
        if video_file and not video_file.content_type.startswith('video/'):
            return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)

        completed_count = feedback_request.assignments.filter(
            status=FeedbackAssignment.STATUS_COMPLETED
        ).count()
        video_count = feedback_request.assignments.filter(
            status=FeedbackAssignment.STATUS_COMPLETED,
            is_video_review=True,
        ).count()
        would_completed = completed_count + 1
        would_video = video_count + (1 if video_file else 0)
        if would_completed >= feedback_request.required_reviews and would_video < feedback_request.video_required_count:
            return Response(
                {'error': 'A video review is required to complete this request.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = Comment.objects.create(
            session=feedback_request.session,
            user=request.user,
            timestamp_seconds=timestamp,
            text=text,
            video_reply=video_file,
        )

        assignment.status = FeedbackAssignment.STATUS_COMPLETED
        assignment.completed_at = timezone.now()
        assignment.is_video_review = bool(video_file)
        assignment.comment = comment
        assignment.save(update_fields=['status', 'completed_at', 'is_video_review', 'comment'])

        _refresh_feedback_request_status(feedback_request)

    feedback_request.refresh_from_db()
    assignment.refresh_from_db()
    return Response({
        'feedback_request': FeedbackRequestSerializer(feedback_request, context={'request': request}).data,
        'assignment': FeedbackAssignmentSerializer(assignment, context={'request': request}).data,
    })


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
