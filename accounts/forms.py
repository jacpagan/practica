from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from .models import Role


class SignUpForm(UserCreationForm):
    """Form for registering a new user."""

    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")
    
    def save(self, commit=True):
        """Save user as inactive until email is verified."""
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.is_active = False  # Inactive until email verified
        if commit:
            user.save()
        return user

