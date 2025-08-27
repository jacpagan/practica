from django.urls import path, include
from rest_framework.routers import DefaultRouter
from exercises.views import (
    ExerciseViewSet, exercise_list, exercise_detail,
    exercise_create,
)

app_name = 'exercises'

router = DefaultRouter()
router.register(r'exercises', ExerciseViewSet)

urlpatterns = [
    # Frontend routes
    path('', exercise_list, name='exercise_list'),
    path('create/', exercise_create, name='exercise_create'),
    path('exercise/<uuid:exercise_id>/', exercise_detail, name='exercise_detail'),
    
    # API routes
    path('api/', include(router.urls)),
]
