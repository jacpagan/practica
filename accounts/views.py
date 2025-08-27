from django.contrib.auth import login
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib import messages
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import logging

from django.contrib.auth.models import User
from .forms import SignUpForm
from .models import Profile, Role
from .email_verification import email_verification_token
from .tasks import send_verification_email

logger = logging.getLogger(__name__)


def signup(request):
    """Register a new user and send verification email."""
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            student_role = Role.objects.get(name='student')
            Profile.objects.create(user=user, role=student_role)
            
            # Send verification email
            try:
                send_verification_email.delay(user.pk)
            except:
                # Fallback to sync if RQ not available
                send_verification_email(user.pk)
            
            messages.success(
                request, 
                'Account created! Please check your email to verify your account before logging in.'
            )
            return redirect('accounts:login')
    else:
        form = SignUpForm()

    return render(request, "accounts/signup.html", {"form": form})


class EmailVerificationView(View):
    """Handle email verification."""
    
    def get(self, request):
        """Verify email with token."""
        uid = request.GET.get('uid')
        token = request.GET.get('token')
        
        if not uid or not token:
            messages.error(request, 'Invalid verification link.')
            return redirect('accounts:login?m=invalid_or_expired')
        
        try:
            # Decode user ID
            user_id = int(uid)
            user = get_object_or_404(User, pk=user_id)
            
            # Verify token
            if email_verification_token.verify_token(token, user):
                profile = user.profile
                profile.verify_email()
                logger.info(f"Email verified for user: {user.username}")
                messages.success(request, 'Email verified successfully! You can now log in.')
                return redirect(reverse('accounts:login') + '?m=verified')
            else:
                messages.error(request, 'Invalid or expired verification link.')
                return redirect(reverse('accounts:login') + '?m=invalid_or_expired')
                
        except (ValueError, TypeError):
            messages.error(request, 'Invalid verification link.')
            return redirect(reverse('accounts:login') + '?m=invalid_or_expired')


@method_decorator(csrf_exempt, name='dispatch')
class ResendVerificationView(View):
    """Handle resend verification email."""
    
    def post(self, request):
        """Resend verification email with rate limiting."""
        email = request.POST.get('email')
        
        if not email:
            return JsonResponse({'error': 'Email is required.'}, status=400)
        
        # Rate limiting
        ip_address = self._get_client_ip(request)
        rate_limit_key = f"resend_verification:{ip_address}:{email}"
        
        # Check rate limits: 3 per hour, 10 per day
        hourly_count = cache.get(f"{rate_limit_key}:hourly", 0)
        daily_count = cache.get(f"{rate_limit_key}:daily", 0)
        
        if hourly_count >= 3:
            return JsonResponse({
                'error': 'Too many requests. Please wait before requesting another verification email.'
            }, status=429)
        
        if daily_count >= 10:
            return JsonResponse({
                'error': 'Daily limit reached. Please try again tomorrow.'
            }, status=429)
        
        try:
            user = User.objects.get(email=email)
            
            # Don't leak if user exists or is already verified
            if user.profile.is_email_verified():
                return JsonResponse({
                    'message': 'If this email is registered and unverified, a verification email has been sent.'
                })
            
            # Send verification email
            try:
                send_verification_email.delay(user.pk)
            except:
                # Fallback to sync if RQ not available
                send_verification_email(user.pk)
            
            # Update rate limits
            cache.set(f"{rate_limit_key}:hourly", hourly_count + 1, 3600)  # 1 hour
            cache.set(f"{rate_limit_key}:daily", daily_count + 1, 86400)   # 24 hours
            
            logger.info(f"Verification email resent for user: {user.username}")
            
            return JsonResponse({
                'message': 'If this email is registered and unverified, a verification email has been sent.'
            })
            
        except User.DoesNotExist:
            # Don't leak if user exists
            return JsonResponse({
                'message': 'If this email is registered and unverified, a verification email has been sent.'
            })
    
    def _get_client_ip(self, request):
        """Get client IP address."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip