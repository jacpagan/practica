from django.contrib import admin
from comments.models import VideoComment


@admin.register(VideoComment)
class VideoCommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'exercise', 'author', 'created_at']
    list_filter = ['created_at', 'author']
    search_fields = ['text', 'exercise__name', 'author__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
