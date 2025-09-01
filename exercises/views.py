from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, filters
from rest_framework.parsers import MultiPartParser, FormParser
from exercises.models import Exercise
from exercises.serializers import ExerciseSerializer
from exercises.permissions import IsTeacherOrAdminForExercise
from accounts.models import Role, Profile
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
    
    # Get comments for this exercise
    from comments.models import VideoComment
    comments = VideoComment.objects.filter(exercise=exercise).order_by('-created_at')
    
    # Debug logging
    logger.info(f"Exercise detail view - exercise_id: {exercise_id}")
    logger.info(f"Exercise has video_asset: {hasattr(exercise, 'video_asset')}")
    logger.info(f"Found {comments.count()} comments for exercise {exercise_id}")
    if hasattr(exercise, 'video_asset') and exercise.video_asset:
        logger.info(f"Video asset fields: youtube_url={getattr(exercise.video_asset, 'youtube_url', 'N/A')}, video_type={getattr(exercise.video_asset, 'video_type', 'N/A')}")
    
    return render(request, 'exercises/exercise_detail.html', {
        'exercise': exercise,
        'comments': comments
    })


@login_required
def exercise_create(request):
    """Create new exercise (teachers only)"""
    
    # Check if user is a teacher or admin
    if not request.user.is_staff:
        if not hasattr(request.user, 'profile') or not request.user.profile.role:
            messages.error(request, 'You must be a teacher to create exercises.')
            return redirect('exercises:exercise_list')
        
        if request.user.profile.role.name != 'instructor':
            messages.error(request, 'Only teachers can create exercises.')
            return redirect('exercises:exercise_list')
    
    if request.method == 'POST':
        try:
            # Handle form submission
            name = request.POST.get('name')
            description = request.POST.get('description', '')
            video_file = request.FILES.get('video')
            youtube_url = request.POST.get('youtube_url', '').strip()
            
            # Debug logging
            logger.info(f"Form data - name: {name}, description: {description}")
            logger.info(f"Files in request: {list(request.FILES.keys())}")
            logger.info(f"Video file: {video_file}")
            logger.info(f"YouTube URL: {youtube_url}")
            if video_file:
                logger.info(f"Video file details - name: {video_file.name}, size: {video_file.size}")
            
            if not name:
                messages.error(request, 'Exercise name is required.')
                return render(request, 'exercises/exercise_create.html')
            
            if not video_file and not youtube_url:
                messages.error(request, 'Either a video file or YouTube URL is required.')
                return render(request, 'exercises/exercise_create.html')
            
            if video_file and youtube_url:
                messages.error(request, 'Please provide either a video file or YouTube URL, not both.')
                return render(request, 'exercises/exercise_create.html')
            
            # Create exercise data - let the serializer handle video processing
            exercise_data = {
                'name': name,
                'description': description,
            }
            
            if video_file:
                exercise_data['video'] = video_file
            elif youtube_url:
                exercise_data['youtube_url'] = youtube_url
            
            # Create serializer with request context for user access
            from exercises.serializers import ExerciseSerializer
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


def user_login(request):
    """Enhanced user login/signup view with security features"""
    if request.method == 'POST':
        action = request.POST.get('action', 'login')
        
        if action == 'signup':
            return _handle_signup(request)
        else:
            return _handle_login(request)
    
    return render(request, 'exercises/login.html')


def _handle_signup(request):
    """Handle user signup"""
    username = request.POST.get('username')
    email = request.POST.get('email')
    password1 = request.POST.get('password1')
    password2 = request.POST.get('password2')
    role_name = request.POST.get('role')
    
    # Validation
    if not all([username, email, password1, password2, role_name]):
        messages.error(request, 'All fields are required.')
        return render(request, 'exercises/login.html')
    
    if password1 != password2:
        messages.error(request, 'Passwords do not match.')
        return render(request, 'exercises/login.html')
    
    if len(password1) < 8:
        messages.error(request, 'Password must be at least 8 characters long.')
        return render(request, 'exercises/login.html')
    
    # Check if username already exists
    if User.objects.filter(username=username).exists():
        messages.error(request, 'Username already exists.')
        return render(request, 'exercises/login.html')
    
    # Check if email already exists
    if User.objects.filter(email=email).exists():
        messages.error(request, 'Email already exists.')
        return render(request, 'exercises/login.html')
    
    # Validate role
    try:
        role = Role.objects.get(name=role_name)
    except Role.DoesNotExist:
        messages.error(request, 'Invalid role selected.')
        return render(request, 'exercises/login.html')
    
    try:
        # Create user (active immediately for MVP)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password1,
            is_active=True  # Active immediately for MVP
        )
        
        # Create profile with role
        Profile.objects.create(user=user, role=role)
        
        logger.info(f"New user registered: {username} with role: {role_name}")
        messages.success(
            request, 
            f'Account created successfully! Welcome to Practika as a {role_name}!'
        )
        # Log the user in and redirect to exercise list
        login(request, user)
        
        # Handle redirect after signup
        next_url = request.GET.get('next')
        if next_url:
            return redirect(next_url)
        else:
            if role_name == "instructor":
                return redirect('accounts:teacher_dashboard')
            else:
                return redirect('accounts:student_dashboard')
        
    except Exception as e:
        logger.error(f"Signup error: {e}")
        messages.error(request, 'An error occurred during registration. Please try again.')
        return render(request, 'exercises/login.html')


def _handle_login(request):
    """Handle user login"""
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

            # Handle redirect after login
            next_url = request.GET.get('next')
            if next_url:
                return redirect(next_url)
            else:
                # Route based on user role
                profile = getattr(user, "profile", None)
                if profile and profile.role:
                    if profile.role.name == "instructor":
                        return redirect('accounts:teacher_dashboard')
                    elif profile.role.name == "student":
                        return redirect('accounts:student_dashboard')
                
                # Fallback to exercise list if no role or unknown role
                return redirect('exercises:exercise_list')
        else:
            logger.warning(f"Login attempt for inactive user: {username}")
            messages.error(request, 'Account is not active.')
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
    permission_classes = [IsTeacherOrAdminForExercise]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@login_required
def welcome_flow(request):
    """Welcome flow for new users"""
    user = request.user
    
    # Debug logging
    logger.info(f"Welcome flow accessed by user: {user.username}")
    
    if request.method == 'POST':
        # Mark onboarding as completed (for MVP, just redirect)
        messages.success(request, 'Welcome to Practika! Let\'s get started.')
        return redirect('exercises:exercise_list')
    
    logger.info(f"Rendering welcome template for user: {user.username}")
    return render(request, 'exercises/welcome.html', {
        'user': user,
        'total_exercises': Exercise.objects.count(),
        'total_users': User.objects.count(),
    })
