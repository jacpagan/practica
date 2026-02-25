from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
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
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly

from .models import Profile, Exercise, Session, Chapter, Comment
from .serializers import (
    UserSerializer, RegisterSerializer,
    ExerciseSerializer, SessionSerializer, SessionListSerializer,
    ChapterSerializer, CommentSerializer, ProgressChapterSerializer,
)


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


# ── Exercise views ──────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [AllowAny]

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        exercise = self.get_object()
        chapters = (
            exercise.chapters
            .select_related('session')
            .order_by('session__recorded_at')
        )
        serializer = ProgressChapterSerializer(chapters, many=True)
        return Response({
            'exercise': ExerciseSerializer(exercise).data,
            'chapters': serializer.data,
        })


# ── Session views ───────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.prefetch_related(
        'chapters', 'chapters__exercise',
        'comments', 'comments__user', 'comments__user__profile',
    )
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == 'list':
            return SessionListSerializer
        return SessionSerializer

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)

    @action(detail=True, methods=['post'])
    def add_chapter(self, request, pk=None):
        session = self.get_object()
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

        serializer = ChapterSerializer(data={
            'session': session.id,
            'exercise': exercise.id if exercise else None,
            'title': request.data.get('title', ''),
            'timestamp_seconds': request.data.get('timestamp_seconds', 0),
            'end_seconds': request.data.get('end_seconds'),
            'notes': request.data.get('notes', ''),
        })

        if serializer.is_valid():
            serializer.save()
            return Response(
                SessionSerializer(session).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path='chapters/(?P<chapter_id>[0-9]+)')
    def remove_chapter(self, request, pk=None, chapter_id=None):
        session = self.get_object()
        chapter = get_object_or_404(Chapter, pk=chapter_id, session=session)
        chapter.delete()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        session = self.get_object()

        if not request.user.is_authenticated:
            return Response({'error': 'Login required to comment'}, status=status.HTTP_401_UNAUTHORIZED)

        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'Comment text required'}, status=status.HTTP_400_BAD_REQUEST)

        ts = request.data.get('timestamp_seconds')
        timestamp = int(ts) if ts is not None and str(ts).strip() != '' else None

        Comment.objects.create(
            session=session,
            user=request.user,
            timestamp_seconds=timestamp,
            text=text,
            video_reply=request.FILES.get('video_reply'),
        )

        session.refresh_from_db()
        return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='comments/(?P<comment_id>[0-9]+)')
    def remove_comment(self, request, pk=None, comment_id=None):
        session = self.get_object()
        comment = get_object_or_404(Comment, pk=comment_id, session=session)

        if request.user != comment.user and not request.user.is_staff:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        comment.delete()
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
