from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    # Health check and monitoring endpoints
    path('health/', views.health_check, name='health_check'),
    path('status/', views.system_status, name='system_status'),
    path('metrics/', views.metrics, name='metrics'),
    path('logs/', views.logs, name='logs'),
    path('test/', views.test_endpoint, name='test_endpoint'),
]
