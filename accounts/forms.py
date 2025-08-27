from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

from .models import Role


class SignUpForm(UserCreationForm):
    """Form for registering a new user along with a role."""

    email = forms.EmailField(required=True)
    role = forms.ModelChoiceField(queryset=Role.objects.all(), required=True)

    class Meta:
        model = User
        fields = ("username", "email", "role", "password1", "password2")

