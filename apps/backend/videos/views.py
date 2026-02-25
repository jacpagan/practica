from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import Exercise, Session, Chapter
from .serializers import (
    ExerciseSerializer, SessionSerializer, SessionListSerializer,
    ChapterSerializer, ProgressChapterSerializer,
)


@method_decorator(csrf_exempt, name='dispatch')
class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """All chapters for this exercise across sessions, chronological."""
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


@method_decorator(csrf_exempt, name='dispatch')
class SessionViewSet(viewsets.ModelViewSet):
    queryset = Session.objects.prefetch_related('chapters', 'chapters__exercise')

    def get_serializer_class(self):
        if self.action == 'list':
            return SessionListSerializer
        return SessionSerializer

    @action(detail=True, methods=['post'])
    def add_chapter(self, request, pk=None):
        """Add a chapter marker to this session."""
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
        """Remove a chapter from this session."""
        session = self.get_object()
        chapter = get_object_or_404(Chapter, pk=chapter_id, session=session)
        chapter.delete()
        return Response(SessionSerializer(session).data)


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

    try:
        cache.set('health_check', 'ok', 10)
        cache.get('health_check')
        health_status['services']['redis'] = 'healthy'
    except Exception as e:
        health_status['services']['redis'] = f'unhealthy: {e}'

    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)
