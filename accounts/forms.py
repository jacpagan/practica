from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError



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

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("Email already exists", code="duplicate_email")
        return email


class VerifiedAuthenticationForm(AuthenticationForm):
    """Authentication form that ensures the user's email is verified."""
    def clean(self):
        username = self.data.get("username")
        if username:
            try:
                user = User.objects.get(username=username)
                profile = getattr(user, "profile", None)
                if not profile or not profile.is_email_verified():
                    raise ValidationError(
                        "Please verify your email address before logging in.",
                        code="email_not_verified",
                    )
            except User.DoesNotExist:
                pass
        return super().clean()

