"""
URL configuration for practika_project project.
"""

from django.urls import path, include
from django.http import HttpResponse

def simple_home(request):
    return HttpResponse("Django app is running successfully! Test 2", content_type="text/plain")

urlpatterns = [
    path('', simple_home, name='home'),
    path('core/', include('core.urls')),
    path('exercises/', include('exercises.urls')),
    path('comments/', include('comments.urls')),
]
