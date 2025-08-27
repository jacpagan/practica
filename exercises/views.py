from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser
from exercises.models import Exercise
from exercises.serializers import ExerciseSerializer
from exercises.permissions import IsAdminForExercise
import logging



logger = logging.getLogger(__name__)

# Template-based views for frontend
def exercise_list(request):
    """Display list of all exercises"""
    exercises = Exercise.objects.all().prefetch_related('videocomment_set', 'videocomment_set__author', 'videocomment_set__video_asset')
    return render(request, 'exercises/exercise_list.html', {'exercises': exercises})


def exercise_detail(request, exercise_id):
    """Display single exercise with comments ordered by newest first"""
    exercise = get_object_or_404(Exercise, id=exercise_id)
    return render(request, 'exercises/exercise_detail.html', {'exercise': exercise})


@login_required
def exercise_create(request):
    """Create new exercise (all authenticated users)"""
    
    if request.method == 'POST':
        try:
            # Handle form submission
            name = request.POST.get('name')
            description = request.POST.get('description', '')
            video_file = request.FILES.get('video')
            
            # Debug logging
            logger.info(f"Form data - name: {name}, description: {description}")
            logger.info(f"Files in request: {list(request.FILES.keys())}")
            logger.info(f"Video file: {video_file}")
            if video_file:
                logger.info(f"Video file details - name: {video_file.name}, size: {video_file.size}")
            
            if not name:
                messages.error(request, 'Exercise name is required.')
                return render(request, 'exercises/exercise_create.html')
            
            if not video_file:
                messages.error(request, 'Video file is required.')
                return render(request, 'exercises/exercise_create.html')
            
            # Create exercise data - let the serializer handle video processing
            exercise_data = {
                'name': name,
                'description': description,
                'video': video_file,  # Pass the video file directly
            }
            
            # Create serializer with request context for user access
            serializer = ExerciseSerializer(data=exercise_data, context={'request': request})
            
            if serializer.is_valid():
                exercise = serializer.save()
                messages.success(request, f'Exercise "{exercise.name}" created successfully!')
                return redirect('exercises:exercise_detail', exercise_id=exercise.id)
            else:
                # Log the validation errors for debugging
                logger.error(f"Exercise creation validation failed: {serializer.errors}")
                
                # Show more specific error messages
                error_messages = []
                for field, errors in serializer.errors.items():
                    if isinstance(errors, list):
                        error_messages.extend([f"{field}: {error}" for error in errors])
                    else:
                        error_messages.append(f"{field}: {errors}")
                
                messages.error(request, f'Error creating exercise: {"; ".join(error_messages)}')
                
        except Exception as e:
            logger.error(f"Error creating exercise: {e}")
            messages.error(request, f'Error creating exercise: {str(e)}')
    
    return render(request, 'exercises/exercise_create.html')


# API viewsets
class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [IsAdminForExercise]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
