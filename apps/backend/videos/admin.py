from django.contrib import admin
from .models import (
    Profile, Exercise, Session, Chapter, Comment, InviteCode, Tag, Space,
    SpaceMember, FeedbackRequest, FeedbackAssignment, MultipartSessionUpload,
)


class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 0
    raw_id_fields = ['exercise']


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    raw_id_fields = ['user']


class SpaceMemberInline(admin.TabularInline):
    model = SpaceMember
    extra = 0
    raw_id_fields = ['user']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'display_name']


@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'invite_slug', 'created_at']
    list_filter = ['owner']
    inlines = [SpaceMemberInline]


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'created_at']
    search_fields = ['name', 'category']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'space', 'recorded_at']
    search_fields = ['title', 'description']
    list_filter = ['user', 'space']
    inlines = [ChapterInline, CommentInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'exercise', 'timestamp_seconds']
    list_filter = ['exercise']
    raw_id_fields = ['session', 'exercise']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'user', 'timestamp_seconds', 'created_at']
    list_filter = ['user']
    raw_id_fields = ['session', 'user']


@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'created_by', 'space', 'used_by', 'created_at']
    list_filter = ['created_at']


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']


@admin.register(FeedbackRequest)
class FeedbackRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'requester', 'space', 'status', 'due_at', 'created_at']
    list_filter = ['status', 'space']
    search_fields = ['session__title', 'requester__username', 'focus_prompt']
    raw_id_fields = ['session', 'requester', 'space']


@admin.register(FeedbackAssignment)
class FeedbackAssignmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'feedback_request', 'reviewer', 'status', 'is_video_review', 'claimed_at', 'completed_at']
    list_filter = ['status', 'is_video_review']
    raw_id_fields = ['feedback_request', 'reviewer', 'comment']


@admin.register(MultipartSessionUpload)
class MultipartSessionUploadAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'size_bytes', 'original_filename', 'created_at', 'expires_at', 'completed_at']
    list_filter = ['status']
    search_fields = ['user__username', 'original_filename', 's3_key', 's3_upload_id']
    raw_id_fields = ['user', 'space', 'session']
