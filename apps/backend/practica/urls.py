from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter
from videos.views import (
    SessionViewSet, ExerciseViewSet, SpaceViewSet, health_check,
    register_view, login_view, me_view,
    create_invite, accept_invite, tag_list,
    join_space, space_info,
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
    path('api/invite/create/', create_invite, name='create_invite'),
    path('api/invite/accept/', accept_invite, name='accept_invite'),
    path('api/tags/', tag_list, name='tag_list'),
    path('api/join/<slug:slug>/', join_space, name='join_space'),
    path('api/space-info/<slug:slug>/', space_info, name='space_info'),
    path('health/', health_check, name='health_check'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.FRONTEND_DIR.exists():
    urlpatterns += [
        re_path(r'^(?!api/|admin/|health/|static/|media/|assets/).*$',
                TemplateView.as_view(template_name='index.html'),
                name='spa'),
    ]
