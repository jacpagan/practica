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
from exercises.permissions import IsAdminForExercise
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
    
    # Validation
    if not all([username, email, password1, password2]):
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
    
    try:
        # Create user (inactive until email verified)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password1,
            is_active=False  # Inactive until email verified
        )
        
        # Create profile (everyone is a student by default)
        student_role = Role.objects.get(name='student')
        Profile.objects.create(user=user, role=student_role)
        
        # Send verification email
        from accounts.tasks import send_verification_email
        try:
            send_verification_email.delay(user.pk)
        except:
            # Fallback to sync if RQ not available
            send_verification_email(user.pk)
        
        # TEMPORARY: Activate user immediately for testing
        user.is_active = True
        user.save()
        user.profile.verify_email()  # Mark email as verified
        
        logger.info(f"New user registered: {username}")
        messages.success(
            request, 
            'Account created successfully! You can now log in.'
        )
        return redirect('exercises:login')
        
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
    
    # Check if user exists and get their status before authentication
    try:
        existing_user = User.objects.get(username=username)
        if not existing_user.is_active:
            # TEMPORARY: Activate inactive users for testing
            existing_user.is_active = True
            existing_user.save()
            if hasattr(existing_user, 'profile'):
                existing_user.profile.verify_email()
            
            logger.info(f"Activated inactive user: {username}")
        # User exists but is inactive - check if it's due to email verification
        # if hasattr(existing_user, 'profile') and not existing_user.profile.is_email_verified():
        #     logger.warning(f"Login attempt for unverified user: {username}")
        #     messages.error(
        #         request, 
        #         'Please verify your email address before logging in. '
        #         '<a href="#" onclick="showResendForm()">Resend verification email</a>'
        #     )
        #     return render(request, 'exercises/login.html')
    except User.DoesNotExist:
        pass  # User doesn't exist, will be handled by authentication
    
    # Attempt authentication
    user = authenticate(request, username=username, password=password)
    
    if user is not None:
        if user.is_active:  # TEMPORARY: Removed email verification requirement
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
            # This should not happen due to the check above, but just in case
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
    permission_classes = [IsAdminForExercise]
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
    
    # Check if user has completed onboarding
    if hasattr(user, 'profile') and user.profile.onboarding_completed:
        return redirect('exercises:exercise_list')
    
    if request.method == 'POST':
        # Mark onboarding as completed
        if hasattr(user, 'profile'):
            user.profile.onboarding_completed = True
            user.profile.save()
        
        messages.success(request, 'Welcome to Practika! Let\'s get started.')
        return redirect('exercises:exercise_list')
    
    return render(request, 'exercises/welcome.html', {
        'user': user,
        'total_exercises': Exercise.objects.count(),
        'total_users': User.objects.count(),
    })
