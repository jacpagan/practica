from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import secrets
from django.db.models.signals import post_save
from django.dispatch import receiver



class Role(models.Model):
    """Represents a role that a user can have in the system."""

    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:  # pragma: no cover - simple string representation
        return self.name


class Profile(models.Model):
    """Stores additional information about a user including their role and email verification."""

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    
    # Onboarding and user experience fields
    onboarding_completed = models.BooleanField(default=False)
    first_login_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)
    
    def is_email_verified(self):
        """Check if user's email is verified (MVP approach - always True)."""
        return True  # MVP approach - no email verification required
    
    def verify_email(self):
        """Mark email as verified (MVP approach - no-op)."""
        pass  # MVP approach - no email verification required

    def __str__(self) -> str:  # pragma: no cover - simple string representation
        return self.user.username

def _generate_token():
    return secrets.token_urlsafe(16)


class BetaInvitation(models.Model):
    """Invitation for beta access."""

    email = models.EmailField(unique=True)
    token = models.CharField(max_length=64, unique=True, default=_generate_token)
    accepted_at = models.DateTimeField(null=True, blank=True)

    def mark_accepted(self):
        self.accepted_at = timezone.now()
        self.save(update_fields=["accepted_at"])

    def __str__(self):  # pragma: no cover - simple string representation
        return self.email

class UserMetrics(models.Model):
    """Stores engagement metrics for a user."""

    profile = models.OneToOneField(
        Profile, on_delete=models.CASCADE, related_name="metrics"
    )
    exercises_created = models.PositiveIntegerField(default=0)
    comments_made = models.PositiveIntegerField(default=0)
    total_video_time = models.PositiveIntegerField(default=0)  # in seconds

    def __str__(self) -> str:  # pragma: no cover - simple string representation
        return f"Metrics for {self.profile.user.username}"


@receiver(post_save, sender=Profile)
def create_user_metrics(sender, instance, created, **kwargs):
    """Automatically create UserMetrics when a Profile is created."""
    if created:
        UserMetrics.objects.create(profile=instance)

