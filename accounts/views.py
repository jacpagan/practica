from django.contrib.auth import login
from django.shortcuts import render, redirect

from .forms import SignUpForm
from .models import Profile


def signup(request):
    """Register a new user and log them in."""

    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            role = form.cleaned_data["role"]
            Profile.objects.create(user=user, role=role)
            login(request, user)
            return redirect("home")
    else:
        form = SignUpForm()

    return render(request, "accounts/signup.html", {"form": form})

