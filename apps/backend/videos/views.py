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
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Profile, Exercise, Session, Chapter, Comment, TeacherStudent, InviteCode, SessionLastSeen
from .serializers import (
    UserSerializer, RegisterSerializer,
    ExerciseSerializer, SessionSerializer, SessionListSerializer,
    ChapterSerializer, CommentSerializer, ProgressChapterSerializer,
)


def _visible_user_ids(user):
    """Return the set of user IDs whose sessions this user can see."""
    ids = {user.id}
    if hasattr(user, 'profile') and user.profile.role == 'teacher':
        ids |= set(TeacherStudent.objects.filter(teacher=user).values_list('student_id', flat=True))
    else:
        ids |= set(TeacherStudent.objects.filter(student=user).values_list('teacher_id', flat=True))
    return ids


def _can_view_session(user, session):
    """Check if user can view a specific session."""
    if not user.is_authenticated:
        return False
    return session.user_id in _visible_user_ids(user)


def _can_modify_session(user, session):
    """Check if user can modify a session (owner or linked teacher)."""
    if not user.is_authenticated:
        return False
    if session.user_id == user.id:
        return True
    if hasattr(user, 'profile') and user.profile.role == 'teacher':
        return TeacherStudent.objects.filter(teacher=user, student_id=session.user_id).exists()
    return False


# ── Auth views ──────────────────────────────────────────────────────

@csrf_exempt
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


# ── Invite views ────────────────────────────────────────────────────

@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_invite(request):
    code = secrets.token_hex(4).upper()
    InviteCode.objects.create(code=code, created_by=request.user)
    return Response({'code': code}, status=status.HTTP_201_CREATED)


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

        creator = invite.created_by
        acceptor = request.user

        if creator == acceptor:
            return Response({'error': 'Cannot use your own invite code'}, status=status.HTTP_400_BAD_REQUEST)

        creator_role = creator.profile.role if hasattr(creator, 'profile') else 'student'
        acceptor_role = acceptor.profile.role if hasattr(acceptor, 'profile') else 'student'

        if creator_role == acceptor_role:
            return Response(
                {'error': f'Both users are {creator_role}s. One must be a teacher and the other a student.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if creator_role == 'teacher':
            teacher, student = creator, acceptor
        else:
            teacher, student = acceptor, creator

        link, created = TeacherStudent.objects.get_or_create(teacher=teacher, student=student)

        invite.used_by = acceptor
        invite.used_at = timezone.now()
        invite.save()

    return Response({
        'message': 'Linked successfully',
        'teacher': UserSerializer(teacher).data.get('display_name'),
        'student': UserSerializer(student).data.get('display_name'),
        'already_linked': not created,
        'user': UserSerializer(acceptor).data,
    })


@csrf_exempt
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_link(request, user_id):
    other = get_object_or_404(User, pk=user_id)
    deleted = TeacherStudent.objects.filter(
        Q(teacher=request.user, student=other) | Q(teacher=other, student=request.user)
    ).delete()
    if deleted[0] == 0:
        return Response({'error': 'No link found'}, status=status.HTTP_404_NOT_FOUND)
    return Response({'message': 'Unlinked', 'user': UserSerializer(request.user).data})


# ── Exercise views ──────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        exercise = self.get_object()
        visible = _visible_user_ids(request.user)
        qs = (
            exercise.chapters
            .select_related('session')
            .filter(session__user_id__in=visible)
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
        qs = Session.objects.prefetch_related(
            'chapters', 'chapters__exercise',
            'comments', 'comments__user', 'comments__user__profile',
            'last_seen_by',
        ).select_related('user', 'user__profile')

        visible = _visible_user_ids(self.request.user)
        return qs.filter(user_id__in=visible)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_serializer_class(self):
        if self.action == 'list':
            return SessionListSerializer
        return SessionSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only delete your own sessions.")
        instance.delete()

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
            exercise, _ = Exercise.objects.get_or_create(
                name__iexact=exercise_name,
                defaults={'name': exercise_name},
            )

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
            'session': session.id,
            'exercise': exercise.id if exercise else None,
            'title': request.data.get('title', ''),
            'timestamp_seconds': ts,
            'end_seconds': end,
            'notes': request.data.get('notes', ''),
        })

        if serializer.is_valid():
            serializer.save()
            session.refresh_from_db()
            return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
            timestamp_seconds=timestamp, text=text,
            video_reply=video_file,
        )
        session.refresh_from_db()
        return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_seen(self, request, pk=None):
        """Mark feedback on this session as seen by the current user."""
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
        'version': '2.0.0',
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
