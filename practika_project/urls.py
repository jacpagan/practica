"""
URL configuration for practika_project project.
"""

from django.urls import path, include
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required

def home_landing(request):
    """Show landing page with app introduction"""
    return render(request, 'home.html')

@login_required
def home_redirect(request):
    """Redirect authenticated users to exercises list"""
    return redirect('exercises:exercise_list')

urlpatterns = [
    path('', home_landing, name='home'),
    path('app/', home_redirect, name='app_home'),
    path('core/', include('core.urls')),
    path('exercises/', include('exercises.urls')),
    path('comments/', include('core.urls')),
]
