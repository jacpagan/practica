from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
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
from videos.v1_views import (
    v1_register, v1_login, v1_logout, v1_me,
    v1_sessions, v1_session_detail,
    v1_upload_request, v1_upload_sign_part, v1_upload_status, v1_upload_complete, v1_upload_abort,
    v1_session_comments, v1_session_review_links,
    v1_review_link_verify_pin, v1_review_link_feedback, v1_review_link_revoke, v1_review_link_public,
    v1_analytics_summary, v1_analytics_weekly,
)

router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'spaces', SpaceViewSet, basename='space')

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
    path('health/live', health_check, name='health_live'),
    path('health/ready', ready_check, name='health_ready'),
    path('health/live/', health_check, name='health_live_slash'),
    path('health/ready/', ready_check, name='health_ready_slash'),
    path('favicon.ico', favicon, name='favicon'),

    path('api/v1/auth/register', v1_register, name='v1_register'),
    path('api/v1/auth/login', v1_login, name='v1_login'),
    path('api/v1/auth/logout', v1_logout, name='v1_logout'),
    path('api/v1/auth/me', v1_me, name='v1_me'),

    path('api/v1/sessions', v1_sessions, name='v1_sessions'),
    path('api/v1/sessions/<int:session_id>', v1_session_detail, name='v1_session_detail'),
    path('api/v1/sessions/<int:session_id>/comments', v1_session_comments, name='v1_session_comments'),
    path('api/v1/sessions/<int:session_id>/review-links', v1_session_review_links, name='v1_session_review_links'),

    path('api/v1/uploads/request', v1_upload_request, name='v1_upload_request'),
    path('api/v1/uploads/<int:upload_id>/sign-part', v1_upload_sign_part, name='v1_upload_sign_part'),
    path('api/v1/uploads/<int:upload_id>/status', v1_upload_status, name='v1_upload_status'),
    path('api/v1/uploads/<int:upload_id>/complete', v1_upload_complete, name='v1_upload_complete'),
    path('api/v1/uploads/<int:upload_id>/abort', v1_upload_abort, name='v1_upload_abort'),

    path('api/v1/review-links/<slug:token>', v1_review_link_public, name='v1_review_link_public'),
    path('api/v1/review-links/<slug:token>/verify-pin', v1_review_link_verify_pin, name='v1_review_link_verify_pin'),
    path('api/v1/review-links/<slug:token>/feedback', v1_review_link_feedback, name='v1_review_link_feedback'),
    path('api/v1/review-links/<int:review_link_id>/revoke', v1_review_link_revoke, name='v1_review_link_revoke'),

    path('api/v1/analytics/me/summary', v1_analytics_summary, name='v1_analytics_summary'),
    path('api/v1/analytics/me/weekly', v1_analytics_weekly, name='v1_analytics_weekly'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.FRONTEND_DIR.exists():
    urlpatterns += [
        re_path(r'^(?!api/|admin/|health/|static/|media/|assets/).*$',
                TemplateView.as_view(template_name='index.html'),
                name='spa'),
    ]
