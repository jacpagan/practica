from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import render
from rest_framework.routers import DefaultRouter
from videos.views import (
    SessionViewSet, ReviewRequestViewSet, health_check,
    ready_check,
    register_view, login_view, me_view,
    client_error_view,
    review_link_info, review_link_feedback,
    teacher_inbox, teacher_roster,
    favicon,
)

router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'review-requests', ReviewRequestViewSet, basename='review-request')


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
    path('api/review/<slug:token>/', review_link_info, name='review_link_info'),
    path('api/review/<slug:token>/feedback/', review_link_feedback, name='review_link_feedback'),
    path('api/teacher/inbox/', teacher_inbox, name='teacher_inbox'),
    path('api/teacher/roster/', teacher_roster, name='teacher_roster'),
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
