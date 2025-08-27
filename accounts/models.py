from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


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

    def is_email_verified(self):
        """Check if user's email is verified."""
        return self.email_verified_at is not None
    
    def verify_email(self):
        """Mark email as verified."""
        self.email_verified_at = timezone.now()
        self.user.is_active = True
        self.user.save(update_fields=['is_active'])
        self.save(update_fields=['email_verified_at'])

    def __str__(self) -> str:  # pragma: no cover - simple string representation
        return self.user.username