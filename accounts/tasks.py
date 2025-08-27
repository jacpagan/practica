"""
Email verification tasks using RQ (Redis Queue).
"""
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
import logging

try:
    from rq import get_current_job
    RQ_AVAILABLE = True
except ImportError:
    RQ_AVAILABLE = False
logger = logging.getLogger(__name__)


def send_verification_email(user_id):
    """Send email verification email to user."""
    try:
        user = User.objects.get(pk=user_id)
        
        # Generate verification token
        from .email_verification import email_verification_token
        token = email_verification_token.generate_token(user)
        
        # Build verification URL
        verification_url = f"{settings.SITE_URL}{reverse('accounts:verify_email')}?uid={user.pk}&token={token}"
        
        # Email content
        subject = 'Verify your Practika account'
        
        # Render email template
        context = {
            'user': user,
            'verification_url': verification_url,
            'site_name': 'Practika',
        }
        
        html_message = render_to_string('accounts/verification_email.html', context)
        plain_message = f"""
        Hi {user.username},
        
        Please verify your email address by clicking the link below:
        
        {verification_url}
        
        This link will expire in 24 hours.
        
        If you didn't create an account with Practika, please ignore this email.
        
        Best regards,
        The Practika Team
        """
        
        # Send email
        send_mail(
            subject=subject,
            message=plain_message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        
        logger.info(f"Verification email sent to {user.email}")
        
    except User.DoesNotExist:
        logger.error(f"User with ID {user_id} not found")
    except Exception as e:
        logger.error(f"Failed to send verification email to user {user_id}: {e}")
        raise
