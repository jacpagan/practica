from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser
from exercises.models import Exercise
from exercises.serializers import ExerciseSerializer
from exercises.permissions import IsAdminForExercise
import re
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
    """Create new exercise (admin only)"""
    if not request.user.is_staff:
        messages.error(request, 'Only staff members can create exercises.')
        return redirect('exercises:exercise_list')
    
    if request.method == 'POST':
        try:
            # Handle form submission
            name = request.POST.get('name')
            description = request.POST.get('description', '')
            video_file = request.FILES.get('video')
            
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
            from exercises.serializers import ExerciseSerializer
            serializer = ExerciseSerializer(data=exercise_data, context={'request': request})
            
            if serializer.is_valid():
                exercise = serializer.save()
                messages.success(request, f'Exercise "{exercise.name}" created successfully!')
                return redirect('exercises:exercise_detail', exercise_id=exercise.id)
            else:
                messages.error(request, f'Error creating exercise: {serializer.errors}')
                # Log the validation errors for debugging
                logger.error(f"Exercise creation validation failed: {serializer.errors}")
                
        except Exception as e:
            logger.error(f"Error creating exercise: {e}")
            messages.error(request, f'Error creating exercise: {str(e)}')
    
    return render(request, 'exercises/exercise_create.html')


def user_login(request):
    """Enhanced user login view with security features"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        # Input validation and sanitization
        if not username or not password:
            messages.error(request, 'Username and password are required.')
            return render(request, 'exercises/login.html')
        
        # Sanitize inputs
        username = username.strip()
        if len(username) > 150:  # Django username max length
            messages.error(request, 'Username is too long.')
            return render(request, 'exercises/login.html')
        
        # Check for suspicious patterns
        suspicious_patterns = [
            r'<script', r'javascript:', r'vbscript:', r'onload=',
            r'union\s+select', r'drop\s+table', r'insert\s+into',
            r'delete\s+from', r'exec\s*\(', r'eval\s*\('
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, username, re.IGNORECASE):
                logger.warning(f"Suspicious login attempt detected: {username}")
                messages.error(request, 'Invalid username format.')
                return render(request, 'exercises/login.html')
        
        # Check if account is locked
        lockout_key = f"account_lockout:{username}"
        if cache.get(lockout_key):
            remaining_time = cache.ttl(lockout_key)
            messages.error(request, f'Account is temporarily locked. Please try again in {remaining_time} seconds.')
            return render(request, 'exercises/login.html')
        
        # Attempt authentication
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if user.is_active:
                # Security logging
                logger.info(f"Successful login: {username} from IP {_get_client_ip(request)}")
                
                # Update last login
                user.last_login = timezone.now()
                user.save(update_fields=['last_login'])
                
                # Login user
                login(request, user)
                
                # Set session security
                request.session.set_expiry(3600)  # 1 hour
                request.session['login_time'] = timezone.now().isoformat()
                request.session['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
                
                messages.success(request, f'Welcome back, {username}!')
                return redirect('exercises:exercise_list')
            else:
                logger.warning(f"Login attempt for inactive user: {username}")
                messages.error(request, 'Account is disabled. Please contact administrator.')
        else:
            # Failed login attempt
            logger.warning(f"Failed login attempt: {username} from IP {_get_client_ip(request)}")
            messages.error(request, 'Invalid username or password.')
    
    return render(request, 'exercises/login.html')


def user_logout(request):
    """Enhanced user logout view with security logging"""
    if request.user.is_authenticated:
        username = request.user.username
        logger.info(f"User logout: {username} from IP {_get_client_ip(request)}")
        
        # Clear session data
        request.session.flush()
        
        logout(request)
        messages.success(request, 'You have been logged out successfully.')
    else:
        messages.info(request, 'You were not logged in.')
    
    return redirect('exercises:exercise_list')


def _get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

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
