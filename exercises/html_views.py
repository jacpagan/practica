from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from exercises.models import Exercise
from comments.models import VideoComment


@login_required
def exercise_list(request):
    """List all exercises"""
    exercises = Exercise.objects.all().order_by('-created_at')
    return render(request, 'exercises/exercise_list.html', {'exercises': exercises})


@login_required
def exercise_detail(request, exercise_id):
    """Show exercise detail with comments"""
    exercise = get_object_or_404(Exercise, id=exercise_id)
    comments = VideoComment.objects.filter(exercise=exercise).order_by('-created_at')
    return render(request, 'exercises/exercise_detail.html', {
        'exercise': exercise,
        'comments': comments
    })
