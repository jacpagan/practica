from django.db import models
from django.contrib.auth.models import User


class Role(models.Model):
    """Represents a role that a user can have in the system."""

    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:  # pragma: no cover - simple string representation
        return self.name


class Profile(models.Model):
    """Stores additional information about a user including their role."""

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True)

    def __str__(self) -> str:  # pragma: no cover - simple string representation
        return self.user.username

