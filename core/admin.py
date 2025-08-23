from django.contrib import admin
from core.models import VideoAsset


@admin.register(VideoAsset)
class VideoAssetAdmin(admin.ModelAdmin):
    list_display = ['id', 'orig_filename', 'mime_type', 'size_bytes', 'created_at']
    list_filter = ['mime_type', 'created_at']
    search_fields = ['orig_filename']
    readonly_fields = ['id', 'checksum_sha256', 'created_at']
