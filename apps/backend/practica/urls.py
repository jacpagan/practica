import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from videos.views import (
    health_check,
    ready_check,
    register_view, login_view, me_view,
    user_search_view,
    client_error_view,
    product_event_insights_view,
    internal_metrics_view,
    invite_codes, invite_code_detail,
    favicon,
)
from videos.library.api import SessionViewSet
from videos.reviews.api import (
    ReviewRequestViewSet,
    review_link_info,
    review_link_challenge_response,
    skill_share_link_info,
    review_link_feedback,
    review_request_feedback,
    feedback_inbox,
    reviewer_invites,
    reviewer_invite_detail,
    reviewer_invite_claim,
    member_connections,
    feedback_insights,
    feedback_templates,
    feedback_template_detail,
    reviewer_inbox,
    reviewer_connections,
    reviewer_roster,
    reviewer_insights,
    reviewer_templates,
    reviewer_template_detail,
)

router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'review-requests', ReviewRequestViewSet, basename='review-request')


def spa_index(request):
    resp = render(request, 'index.html')
    try:
        body = resp.content.decode('utf-8')
        sha = os.getenv('DEPLOYED_GIT_SHA', '')
        if sha:
            # Inject build SHA for client telemetry and diagnostics
            injection = (
                f'\n    <meta name="practica:sha" content="{sha}" />\n'
                f'    <script>window.__DEPLOYED_GIT_SHA = "{sha}";</script>\n'
            )
            body = body.replace('</head>', injection + '</head>')
        resp.content = body.encode('utf-8')
    except Exception:
        pass
    # Prevent caching of index.html so users pick up the newest manifest/assets
    resp['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    resp['Pragma'] = 'no-cache'
    resp['Expires'] = '0'
    return resp


def version_view(request):
    sha = os.getenv('DEPLOYED_GIT_SHA', '')
    built_at = ''
    try:
        from django.conf import settings as dj_settings
        index_path = (dj_settings.FRONTEND_DIR / 'index.html')
        if index_path.exists():
            built_at = str(int(index_path.stat().st_mtime))
    except Exception:
        built_at = ''
    return JsonResponse({'sha': sha, 'built_at': built_at})

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path('api/', include(router.urls)),
    path('version', version_view, name='version'),
    path('api/auth/register/', register_view, name='register'),
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/me/', me_view, name='me'),
    path('api/invite-codes/', invite_codes, name='invite_codes'),
    path('api/invite-codes/<int:invite_id>/', invite_code_detail, name='invite_code_detail'),
    path('api/users/search/', user_search_view, name='user_search'),
    path('api/client-errors/', client_error_view, name='client_error'),
    path('api/product-events/insights/', product_event_insights_view, name='product_event_insights'),
    path('api/internal/metrics/', internal_metrics_view, name='internal_metrics'),
    path('api/review/<slug:token>/', review_link_info, name='review_link_info'),
    path('api/review/<slug:token>/feedback/', review_link_feedback, name='review_link_feedback'),
    path('api/review/<slug:token>/responses/', review_link_challenge_response, name='review_link_challenge_response'),
    path('api/share/skill/<slug:token>/', skill_share_link_info, name='skill_share_link_info'),
    path('api/review-requests/<int:request_id>/feedback/', review_request_feedback, name='review_request_feedback'),
    path('api/inbox/', feedback_inbox, name='feedback_inbox'),
    path('api/reviewer-invites/', reviewer_invites, name='reviewer_invites'),
    path('api/reviewer-invites/claim/', reviewer_invite_claim, name='reviewer_invite_claim'),
    path('api/reviewer-invites/<int:invite_id>/', reviewer_invite_detail, name='reviewer_invite_detail'),
    path('api/connections/', member_connections, name='member_connections'),
    path('api/feedback-insights/', feedback_insights, name='feedback_insights'),
    path('api/feedback-templates/', feedback_templates, name='feedback_templates'),
    path('api/feedback-templates/<int:template_id>/', feedback_template_detail, name='feedback_template_detail'),
    path('api/reviewer/inbox/', reviewer_inbox, name='reviewer_inbox'),
    path('api/reviewer/connections/', reviewer_connections, name='reviewer_connections'),
    path('api/reviewer/roster/', reviewer_roster, name='reviewer_roster'),
    path('api/reviewer/insights/', reviewer_insights, name='reviewer_insights'),
    path('api/reviewer/templates/', reviewer_templates, name='reviewer_templates'),
    path('api/reviewer/templates/<int:template_id>/', reviewer_template_detail, name='reviewer_template_detail'),
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
