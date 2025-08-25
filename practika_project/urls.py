"""
URL configuration for practika_project project.
"""

from django.urls import path
from django.http import HttpResponse

def simple_home(request):
    return HttpResponse("Django app is running successfully!", content_type="text/plain")

urlpatterns = [
    path('', simple_home, name='home'),
]
