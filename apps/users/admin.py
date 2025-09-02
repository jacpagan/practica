# Admin configuration for Practika MVP
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User
from apps.playlists.models import Playlist
from apps.videos.models import Video


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom user admin"""
    list_display = ['email', 'username', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'date_joined']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Practika Profile', {
            'fields': ('role', 'avatar')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Practika Profile', {
            'fields': ('role', 'avatar')
        }),
    )


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    """Playlist admin"""
    list_display = ['title', 'user', 'privacy', 'trust_score', 'trust_level', 'video_count', 'created_at']
    list_filter = ['privacy', 'trust_level', 'created_at']
    search_fields = ['title', 'description', 'user__email']
    readonly_fields = ['trust_score', 'trust_level', 'video_count', 'total_duration', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('user', 'title', 'description', 'tags')
        }),
        ('Settings', {
            'fields': ('privacy',)
        }),
        ('Trust Metrics', {
            'fields': ('trust_score', 'trust_level', 'video_count', 'total_duration')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    """Video admin"""
    list_display = ['title', 'playlist', 'trust_score', 'file_size_mb', 'duration', 'created_at']
    list_filter = ['created_at', 'playlist__privacy']
    search_fields = ['title', 'description', 'playlist__title']
    readonly_fields = ['trust_score', 'file_size_mb', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('playlist', 'title', 'description', 'tags')
        }),
        ('File', {
            'fields': ('file', 'duration')
        }),
        ('Trust Metrics', {
            'fields': ('trust_score', 'file_size_mb')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
