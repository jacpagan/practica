from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import render
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter
from videos.views import (
    SessionViewSet, ExerciseViewSet, SpaceViewSet, health_check,
    ready_check,
    register_view, login_view, me_view,
    client_error_view,
    create_invite, accept_invite, tag_list,
    join_space, space_info,
    coach_metrics_summary,
    review_link_info, review_link_feedback,
    favicon,
)

router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'spaces', SpaceViewSet, basename='space')


def spa_index(request):
    response = render(request, 'index.html')
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/register/', register_view, name='register'),
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/me/', me_view, name='me'),
    path('api/client-errors/', client_error_view, name='client_error'),
    path('api/invite/create/', create_invite, name='create_invite'),
    path('api/invite/accept/', accept_invite, name='accept_invite'),
    path('api/tags/', tag_list, name='tag_list'),
    path('api/coach-metrics/summary/', coach_metrics_summary, name='coach_metrics_summary'),
    path('api/review/<slug:token>/', review_link_info, name='review_link_info'),
    path('api/review/<slug:token>/feedback/', review_link_feedback, name='review_link_feedback'),
    path('api/join/<slug:slug>/', join_space, name='join_space'),
    path('api/space-info/<slug:slug>/', space_info, name='space_info'),
    path('health/', health_check, name='health_check'),
    path('ready/', ready_check, name='ready_check'),
    path('favicon.ico', favicon, name='favicon'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.FRONTEND_DIR.exists():
    urlpatterns += [
        re_path(r'^(?!api/|admin/|health/|static/|media/|assets/).*$',
                spa_index,
                name='spa'),
    ]
