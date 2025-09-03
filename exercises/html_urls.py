from django.urls import path
from exercises import html_views

urlpatterns = [
    path('', html_views.exercise_list, name='exercise_list'),
    path('<uuid:exercise_id>/', html_views.exercise_detail, name='exercise_detail'),
]
