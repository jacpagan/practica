from django.contrib import admin
from .models import (
    Profile, Exercise, Session, Chapter, Comment, InviteCode, Tag, Space,
    SpaceMember, MultipartSessionUpload, ExerciseReferenceClip, SessionAsset,
    PracticePlan, PracticePlanItem, DailyCheckIn, DailyCheckInItem, SpaceReferenceVideo,
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


class PracticePlanItemInline(admin.TabularInline):
    model = PracticePlanItem
    extra = 0
    raw_id_fields = ['exercise', 'reference_clip']


class DailyCheckInItemInline(admin.TabularInline):
    model = DailyCheckInItem
    extra = 0
    raw_id_fields = ['plan_item']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'display_name']


@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'main_session', 'invite_slug', 'created_at']
    list_filter = ['owner']
    inlines = [SpaceMemberInline]


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'created_at']
    search_fields = ['name', 'category']


@admin.register(ExerciseReferenceClip)
class ExerciseReferenceClipAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'title', 'user', 'exercise', 'youtube_video_id', 'start_seconds', 'end_seconds', 'created_at',
    ]
    list_filter = ['exercise']
    search_fields = ['title', 'youtube_video_id', 'youtube_playlist_id', 'user__username', 'exercise__name']
    raw_id_fields = ['user', 'exercise']


@admin.register(SpaceReferenceVideo)
class SpaceReferenceVideoAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'space', 'created_by', 'youtube_video_id', 'start_seconds', 'end_seconds', 'created_at']
    list_filter = ['space']
    search_fields = ['title', 'space__name', 'created_by__username', 'youtube_video_id', 'youtube_playlist_id']
    raw_id_fields = ['space', 'created_by']


@admin.register(PracticePlan)
class PracticePlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'space', 'created_by', 'timezone', 'is_active', 'start_date', 'end_date', 'updated_at']
    list_filter = ['space', 'is_active']
    search_fields = ['name', 'space__name', 'created_by__username']
    raw_id_fields = ['space', 'created_by']
    inlines = [PracticePlanItemInline]


@admin.register(DailyCheckIn)
class DailyCheckInAdmin(admin.ModelAdmin):
    list_display = ['space', 'user', 'date', 'status', 'total_minutes', 'linked_session', 'updated_at']
    list_filter = ['space', 'status', 'date']
    search_fields = ['space__name', 'user__username', 'notes']
    raw_id_fields = ['space', 'user', 'plan', 'linked_session']
    inlines = [DailyCheckInItemInline]


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'space', 'processing_status', 'recorded_at']
    search_fields = ['title', 'description']
    list_filter = ['user', 'space', 'processing_status']
    inlines = [ChapterInline, CommentInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'exercise', 'timestamp_seconds']
    list_filter = ['exercise']
    raw_id_fields = ['session', 'exercise']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'session', 'user', 'timestamp_seconds', 'legacy_text_only', 'created_at']
    list_filter = ['user', 'legacy_text_only']
    raw_id_fields = ['session', 'user']


@admin.register(SessionAsset)
class SessionAssetAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'asset_type', 'object_key', 'created_at']
    list_filter = ['asset_type']
    search_fields = ['object_key', 'session__title', 'session__user__username']
    raw_id_fields = ['session']


@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'created_by', 'space', 'used_by', 'created_at']
    list_filter = ['created_at']


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']


@admin.register(MultipartSessionUpload)
class MultipartSessionUploadAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'size_bytes', 'original_filename', 'created_at', 'expires_at', 'completed_at']
    list_filter = ['status']
    search_fields = ['user__username', 'original_filename', 's3_key', 's3_upload_id']
    raw_id_fields = ['user', 'space', 'session']
