from django.contrib import admin
from .models import (
    Profile, Session, Chapter, VideoFeedback, MultipartSessionUpload, SessionAsset,
    SessionLastSeen,
)


class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 0
    raw_id_fields = ['exercise']


class VideoFeedbackInline(admin.TabularInline):
    model = VideoFeedback
    extra = 0
    raw_id_fields = ['user']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'display_name']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'processing_status', 'recorded_at']
    search_fields = ['title', 'description']
    list_filter = ['user', 'processing_status']
    inlines = [ChapterInline, VideoFeedbackInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'exercise', 'timestamp_seconds']
    list_filter = ['exercise']
    raw_id_fields = ['session', 'exercise']


@admin.register(VideoFeedback)
class VideoFeedbackAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'user', 'timestamp_seconds', 'is_legacy_text_feedback', 'created_at']
    list_filter = ['user', 'is_legacy_text_feedback']
    raw_id_fields = ['session', 'user']


@admin.register(SessionAsset)
class SessionAssetAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'asset_type', 'object_key', 'created_at']
    list_filter = ['asset_type']
    search_fields = ['object_key', 'session__title', 'session__user__username']
    raw_id_fields = ['session']


@admin.register(MultipartSessionUpload)
class MultipartSessionUploadAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'size_bytes', 'original_filename', 'created_at', 'expires_at', 'completed_at']
    list_filter = ['status']
    search_fields = ['user__username', 'original_filename', 's3_key', 's3_upload_id']
    raw_id_fields = ['user', 'session']


@admin.register(SessionLastSeen)
class SessionLastSeenAdmin(admin.ModelAdmin):
    list_display = ['user', 'session', 'seen_at']
    list_filter = ['seen_at']
    search_fields = ['user__username', 'session__title']
    raw_id_fields = ['user', 'session']
