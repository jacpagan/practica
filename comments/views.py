from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from comments.models import VideoComment
from comments.serializers import VideoCommentSerializer
from comments.permissions import IsAuthorOrAdmin
from exercises.models import Exercise
from core.models import VideoAsset


# Template-based views for users
@login_required
def add_comment(request, exercise_id):
    """Add a comment to an exercise"""
    exercise = get_object_or_404(Exercise, id=exercise_id)
    
    if request.method == 'POST':
        text = request.POST.get('text', '').strip()
        video_file = request.FILES.get('video')
        
        if not text and not video_file:
            messages.error(request, 'Please provide either text or a video comment.')
            return redirect('exercises:exercise_detail', exercise_id=exercise_id)
        
        try:
            # Handle video upload if provided
            video_asset = None
            if video_file:
                from core.container import container
                storage_service = container.get_video_storage_service()
                video_asset = storage_service.store_uploaded_video(video_file)
            
            # Create comment - only create if we have either text or video
            if text or video_asset:
                comment = VideoComment.objects.create(
                    exercise=exercise,
                    author=request.user,
                    text=text if text else None,
                    video_asset=video_asset
                )
            else:
                messages.error(request, 'Please provide either text or a video comment.')
                return redirect('exercises:exercise_detail', exercise_id=exercise_id)
            
            messages.success(request, 'Comment added successfully!')
            return redirect('exercises:exercise_detail', exercise_id=exercise_id)
            
        except Exception as e:
            messages.error(request, f'Error adding comment: {str(e)}')
    
    return redirect('exercises:exercise_detail', exercise_id=exercise_id)


@login_required
def edit_comment(request, comment_id):
    """Edit a comment (only by author or admin)"""
    comment = get_object_or_404(VideoComment, id=comment_id)
    
    # Check permissions
    if not (request.user == comment.author or request.user.is_staff):
        messages.error(request, 'You can only edit your own comments.')
        return redirect('exercises:exercise_detail', exercise_id=comment.exercise.id)
    
    if request.method == 'POST':
        text = request.POST.get('text', '').strip()
        
        if text:
            comment.text = text
            comment.save()
            messages.success(request, 'Comment updated successfully!')
        else:
            messages.error(request, 'Comment text cannot be empty.')
        
        return redirect('exercises:exercise_detail', exercise_id=comment.exercise.id)
    
    return redirect('exercises:exercise_detail', exercise_id=comment.exercise.id)


@login_required
def delete_comment(request, comment_id):
    """Delete a comment (only by author or admin)"""
    comment = get_object_or_404(VideoComment, id=comment_id)
    
    # Check permissions
    if not (request.user == comment.author or request.user.is_staff):
        messages.error(request, 'You can only delete your own comments.')
        return redirect('exercises:exercise_detail', exercise_id=comment.exercise.id)
    
    exercise_id = comment.exercise.id
    comment.delete()
    messages.success(request, 'Comment deleted successfully!')
    
    return redirect('exercises:exercise_detail', exercise_id=exercise_id)


# API views
class VideoCommentViewSet(viewsets.ModelViewSet):
    queryset = VideoComment.objects.all()
    serializer_class = VideoCommentSerializer
    permission_classes = [IsAuthorOrAdmin]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['exercise']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
