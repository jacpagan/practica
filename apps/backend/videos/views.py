import secrets
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.db import connection, transaction
from django.db.models import Q
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

from .models import Profile, Exercise, Session, Chapter, Comment, InviteCode, SessionLastSeen, Tag, Space, SpaceMember
from .serializers import (
    UserSerializer, RegisterSerializer, SpaceSerializer,
    ExerciseSerializer, SessionSerializer, SessionListSerializer,
    ChapterSerializer, CommentSerializer, ProgressChapterSerializer, TagSerializer,
)


def _visible_sessions_qs(user):
    """Return a queryset of sessions visible to this user."""
    if hasattr(user, 'profile') and user.profile.role == 'teacher':
        space_ids = SpaceMember.objects.filter(user=user).values_list('space_id', flat=True)
        return Session.objects.filter(space_id__in=space_ids)
    else:
        return Session.objects.filter(user=user)


def _can_view_session(user, session):
    if not user.is_authenticated:
        return False
    if session.user_id == user.id:
        return True
    if hasattr(user, 'profile') and user.profile.role == 'teacher':
        return SpaceMember.objects.filter(user=user, space_id=session.space_id).exists()
    return False


def _can_modify_session(user, session):
    if not user.is_authenticated:
        return False
    if session.user_id == user.id:
        return True
    if hasattr(user, 'profile') and user.profile.role == 'teacher':
        return SpaceMember.objects.filter(user=user, space_id=session.space_id).exists()
    return False


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
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.role == 'teacher':
            space_ids = SpaceMember.objects.filter(user=user).values_list('space_id', flat=True)
            return Space.objects.filter(id__in=space_ids).prefetch_related('members', 'members__user', 'members__user__profile')
        return Space.objects.filter(owner=user).prefetch_related('members', 'members__user', 'members__user__profile')

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
        """Remove a teacher from this space."""
        space = self.get_object()
        if space.owner != request.user:
            return Response({'error': 'Only the space owner can remove members'}, status=status.HTTP_403_FORBIDDEN)
        deleted = SpaceMember.objects.filter(space=space, user_id=user_id).delete()
        if deleted[0] == 0:
            return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SpaceSerializer(space).data)


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
        space = None
        if space_id:
            space = get_object_or_404(Space, pk=space_id, owner=self.request.user)

        session = serializer.save(user=self.request.user, space=space)

        tag_names = self.request.data.get('tags', '')
        if isinstance(tag_names, str):
            tag_names = [t.strip() for t in tag_names.split(',') if t.strip()]
        elif isinstance(tag_names, list):
            tag_names = [t.strip() for t in tag_names if t.strip()]
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
            session.tags.add(tag)

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
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
