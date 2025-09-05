"""
Views for your personal practice tracking system.
"""

from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ExerciseVideo, PracticeThread
from .forms import ExerciseVideoForm, PracticeThreadForm
from .serializers import ExerciseVideoSerializer, PracticeThreadSerializer

def video_list(request):
    """List all your exercise videos"""
    videos = ExerciseVideo.objects.all()
    return render(request, 'videos/video_list.html', {'videos': videos})

def test_view(request):
    """Simple test view to verify Django is working"""
    from django.http import HttpResponse
    return HttpResponse("🎯 Practica Django Backend is working! Your personal practice tracking system is ready.")

def video_detail(request, video_id):
    """Detail view of exercise video with practice threads"""
    video = get_object_or_404(ExerciseVideo, id=video_id)
    practice_threads = video.practice_threads.all()
    return render(request, 'videos/video_detail.html', {
        'video': video,
        'practice_threads': practice_threads
    })

def upload_exercise_video(request):
    """Upload a new exercise video"""
    if request.method == 'POST':
        form = ExerciseVideoForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            messages.success(request, 'Exercise video uploaded successfully!')
            return redirect('video_list')
    else:
        form = ExerciseVideoForm()
    return render(request, 'videos/upload_video.html', {'form': form})

def upload_practice_thread(request, video_id):
    """Upload a practice thread for an exercise video"""
    exercise_video = get_object_or_404(ExerciseVideo, id=video_id)
    if request.method == 'POST':
        form = PracticeThreadForm(request.POST, request.FILES)
        if form.is_valid():
            thread = form.save(commit=False)
            thread.exercise_video = exercise_video
            thread.save()
            messages.success(request, 'Practice thread uploaded successfully!')
            return redirect('video_detail', video_id=video_id)
    else:
        form = PracticeThreadForm()
    return render(request, 'videos/upload_thread.html', {
        'form': form,
        'video': exercise_video
    })

@method_decorator(csrf_exempt, name='dispatch')
class ExerciseVideoViewSet(viewsets.ModelViewSet):
    """API viewset for exercise videos"""
    queryset = ExerciseVideo.objects.all()
    serializer_class = ExerciseVideoSerializer
    
    def list(self, request):
        """List all exercise videos"""
        videos = ExerciseVideo.objects.all()
        serializer = ExerciseVideoSerializer(videos, many=True)
        return Response(serializer.data)
    
    def retrieve(self, request, pk=None):
        """Get a specific exercise video with practice threads"""
        video = get_object_or_404(ExerciseVideo, pk=pk)
        serializer = ExerciseVideoSerializer(video)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Upload a new exercise video"""
        serializer = ExerciseVideoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def upload_thread(self, request, pk=None):
        """Upload a practice thread for an exercise video"""
        exercise_video = get_object_or_404(ExerciseVideo, pk=pk)
        serializer = PracticeThreadSerializer(data=request.data)
        if serializer.is_valid():
            thread = serializer.save(exercise_video=exercise_video)
            # Return the updated exercise video with all threads
            video_serializer = ExerciseVideoSerializer(exercise_video)
            return Response(video_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['put', 'patch'])
    def update_thread(self, request, pk=None):
        """Update a practice thread"""
        exercise_video = get_object_or_404(ExerciseVideo, pk=pk)
        thread_id = request.data.get('thread_id')
        if not thread_id:
            return Response({'error': 'thread_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            thread = exercise_video.practice_threads.get(id=thread_id)
        except PracticeThread.DoesNotExist:
            return Response({'error': 'Practice thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = PracticeThreadSerializer(thread, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Return the updated exercise video with all threads
            video_serializer = ExerciseVideoSerializer(exercise_video)
            return Response(video_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def delete_thread(self, request, pk=None):
        """Delete a practice thread"""
        exercise_video = get_object_or_404(ExerciseVideo, pk=pk)
        thread_id = request.data.get('thread_id')
        if not thread_id:
            return Response({'error': 'thread_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            thread = exercise_video.practice_threads.get(id=thread_id)
            thread.delete()
            # Return the updated exercise video with all threads
            video_serializer = ExerciseVideoSerializer(exercise_video)
            return Response(video_serializer.data, status=status.HTTP_200_OK)
        except PracticeThread.DoesNotExist:
            return Response({'error': 'Practice thread not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['put', 'patch'])
    def update_exercise(self, request, pk=None):
        """Update an exercise video"""
        exercise_video = get_object_or_404(ExerciseVideo, pk=pk)
        serializer = ExerciseVideoSerializer(exercise_video, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def delete_exercise(self, request, pk=None):
        """Delete an exercise video"""
        exercise_video = get_object_or_404(ExerciseVideo, pk=pk)
        exercise_video.delete()
        return Response({'message': 'Exercise video deleted successfully'}, status=status.HTTP_200_OK)


def health_check(request):
    """Health check endpoint for monitoring"""
    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {},
        'version': '1.0.0',
        'environment': 'development' if settings.DEBUG else 'production'
    }
    
    # Check database connectivity
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health_status['services']['database'] = 'healthy'
    except Exception as e:
        health_status['services']['database'] = f'unhealthy: {str(e)}'
        health_status['status'] = 'unhealthy'
    
    # Check Redis connectivity
    try:
        cache.set('health_check', 'ok', 10)
        cache.get('health_check')
        health_status['services']['redis'] = 'healthy'
    except Exception as e:
        health_status['services']['redis'] = f'unhealthy: {str(e)}'
        health_status['status'] = 'unhealthy'
    
    # Check model access
    try:
        ExerciseVideo.objects.count()
        health_status['services']['models'] = 'healthy'
    except Exception as e:
        health_status['services']['models'] = f'unhealthy: {str(e)}'
        health_status['status'] = 'unhealthy'
    
    # Return appropriate HTTP status code
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)