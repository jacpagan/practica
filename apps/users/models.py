# User model for Practika MVP
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    ADMIN = "admin", "Admin"


class User(AbstractUser):
    """
    Custom user model for Practika MVP
    Supports Student and Admin roles
    """
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
    )
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'users'
    
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"
    
    @property
    def is_student(self):
        return self.role == UserRole.STUDENT
    
    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN
