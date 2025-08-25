"""
URL configuration for practika_project project.
"""

from django.http import HttpResponse

def simple_home(request):
    return HttpResponse("Django app is running successfully!")

urlpatterns = [
    ('', simple_home),
]
