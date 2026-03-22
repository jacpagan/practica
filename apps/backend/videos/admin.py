from django.contrib import admin
from .models import (
    Profile, Session, Chapter, VideoFeedback, MultipartSessionUpload, SessionAsset,
    SessionLastSeen,
    SignupInviteCode,
    ReviewRequest, TeacherRosterMembership, FeedbackTemplate,
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


@admin.register(SignupInviteCode)
class SignupInviteCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'label', 'is_active', 'use_count', 'max_uses', 'last_used_at', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['code', 'label']
    raw_id_fields = ['created_by']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'practice_series', 'user', 'processing_status', 'recorded_at']
    search_fields = ['title', 'practice_series', 'description']
    list_filter = ['user', 'processing_status']
    inlines = [ChapterInline, VideoFeedbackInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'exercise', 'timestamp_seconds']
    list_filter = ['exercise']
    raw_id_fields = ['session', 'exercise']


@admin.register(VideoFeedback)
class VideoFeedbackAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'review_request', 'user', 'timestamp_seconds', 'is_legacy_text_feedback', 'created_at']
    list_filter = ['user', 'is_legacy_text_feedback']
    raw_id_fields = ['session', 'review_request', 'user']


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
    search_fields = ['user__username', 'title', 'practice_series', 'original_filename', 's3_key', 's3_upload_id']
    raw_id_fields = ['user', 'session']


@admin.register(SessionLastSeen)
class SessionLastSeenAdmin(admin.ModelAdmin):
    list_display = ['user', 'session', 'seen_at']
    list_filter = ['seen_at']
    search_fields = ['user__username', 'session__title']
    raw_id_fields = ['user', 'session']


@admin.register(TeacherRosterMembership)
class TeacherRosterMembershipAdmin(admin.ModelAdmin):
    list_display = ['reviewer_display', 'member_display', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['teacher__username', 'student__username']
    raw_id_fields = ['teacher', 'student', 'created_by']

    @admin.display(description='Reviewer')
    def reviewer_display(self, obj):
        return obj.teacher

    @admin.display(description='Member')
    def member_display(self, obj):
        return obj.student


@admin.register(ReviewRequest)
class ReviewRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'owner_display', 'reviewer_display', 'instrument', 'status', 'created_at']
    list_filter = ['status', 'instrument']
    search_fields = ['session__title', 'student__username', 'teacher__username', 'goal', 'exercise_or_song']
    raw_id_fields = ['session', 'student', 'teacher', 'created_by', 'review_link']

    @admin.display(description='Owner')
    def owner_display(self, obj):
        return obj.student

    @admin.display(description='Reviewer')
    def reviewer_display(self, obj):
        return obj.teacher


@admin.register(FeedbackTemplate)
class FeedbackTemplateAdmin(admin.ModelAdmin):
    list_display = ['id', 'reviewer_display', 'title', 'updated_at']
    search_fields = ['teacher__username', 'teacher__profile__display_name', 'title', 'text']
    raw_id_fields = ['teacher']

    @admin.display(description='Reviewer')
    def reviewer_display(self, obj):
        return obj.teacher
