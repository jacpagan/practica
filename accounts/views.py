from django.contrib.auth import login
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib import messages
from django.core.cache import cache
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View

from django.core.exceptions import ValidationError
from django.contrib.auth.decorators import login_required


import logging

from django.contrib.auth.models import User
from .forms import SignUpForm
from .models import Profile, Role

from comments.models import VideoComment

from django.contrib.auth.decorators import login_required
from exercises.models import Exercise


logger = logging.getLogger(__name__)


def signup(request):
    """Register a new user (MVP approach - immediate activation)."""
    # Check if roles exist, if not create them
    if Role.objects.count() == 0:
        from django.core.management import call_command
        try:
            call_command('seed_roles')
        except Exception as e:
            logger.error(f"Failed to seed roles: {e}")
            # Create roles manually if command fails
            Role.objects.get_or_create(name='student')
            Role.objects.get_or_create(name='instructor')
    
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            role = form.cleaned_data["role"]
            Profile.objects.create(user=user, role=role)
            
            # Log the user in immediately (MVP approach)
            login(request, user)
            
            messages.success(
                request, 
                f'Account created successfully! Welcome to Practika as a {role.name}!'
            )
            
            # Redirect based on role
            if role.name == "instructor":
                return redirect('accounts:teacher_dashboard')
            else:
                return redirect('accounts:student_dashboard')
    else:
        form = SignUpForm()

    return render(request, "accounts/signup.html", {"form": form})


@login_required
def student_dashboard(request):
    """Display exercises for the logged-in student."""
    # Students should see exercises created by teachers, not their own exercises
    exercises = Exercise.objects.exclude(created_by=request.user).prefetch_related(
        'videocomment_set', 'videocomment_set__author', 'videocomment_set__video_asset'
    )
    
    # Get user's own comments
    from comments.models import VideoComment
    user_comments = VideoComment.objects.filter(author=request.user).select_related(
        'exercise', 'video_asset'
    ).order_by('-created_at')
    
    return render(request, "accounts/student_dashboard.html", {
        "exercises": exercises,
        "user_comments": user_comments
    })


@login_required
def teacher_dashboard(request):
    """Display exercises and comments for the logged-in teacher."""
    user = request.user
    if not hasattr(user, "profile") or user.profile.role is None or user.profile.role.name != "instructor":
        messages.error(request, "You must be a teacher to access this dashboard.")
        return redirect("exercises:exercise_list")

    # Get exercises created by this teacher
    exercises = Exercise.objects.filter(created_by=user).prefetch_related(
        'videocomment_set', 'videocomment_set__author', 'videocomment_set__video_asset'
    )
    
    # Get comments on exercises created by this teacher
    comments = (
        VideoComment.objects
        .filter(exercise__created_by=user)
        .select_related("exercise", "author", "video_asset")
        .order_by("-created_at")
    )
    
    # Get teacher's own comments on other exercises
    teacher_comments = VideoComment.objects.filter(author=user).select_related(
        'exercise', 'video_asset'
    ).order_by('-created_at')

    return render(request, "accounts/teacher_dashboard.html", {
        "exercises": exercises,
        "comments": comments,
        "teacher_comments": teacher_comments
    })
