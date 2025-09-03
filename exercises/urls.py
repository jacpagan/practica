from django.urls import path, include
from rest_framework.routers import DefaultRouter
from exercises.views import (
    ExerciseViewSet, exercise_list, exercise_detail, 
    exercise_create, user_login, user_logout, welcome_flow
)

app_name = 'exercises'

router = DefaultRouter()
router.register(r'exercises', ExerciseViewSet)

urlpatterns = [
    # Frontend routes
    path('', exercise_list, name='exercise_list'),
    path('login/', user_login, name='login'),
    path('logout/', user_logout, name='logout'),
    path('create/', exercise_create, name='exercise_create'),
    path('welcome/', welcome_flow, name='welcome'),
    path('exercise/<uuid:exercise_id>/', exercise_detail, name='exercise_detail'),
    
    # API routes
    path('api/', include(router.urls)),
]
