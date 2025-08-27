from django.contrib import admin
from .models import VideoView, CommentActivity, SessionStat


@admin.register(VideoView)
class VideoViewAdmin(admin.ModelAdmin):
    list_display = ("user", "video", "viewed_at")
    list_filter = ("viewed_at",)


@admin.register(CommentActivity)
class CommentActivityAdmin(admin.ModelAdmin):
    list_display = ("user", "comment", "action", "timestamp")
    list_filter = ("action", "timestamp")


@admin.register(SessionStat)
class SessionStatAdmin(admin.ModelAdmin):
    list_display = ("user", "login_time", "logout_time", "duration_seconds")
    list_filter = ("login_time",)
