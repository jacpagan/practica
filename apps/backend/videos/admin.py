"""
Admin configuration for your personal practice tracking system.
"""

from django.contrib import admin
from .models import ExerciseVideo, PracticeThread

@admin.register(ExerciseVideo)
class ExerciseVideoAdmin(admin.ModelAdmin):
    """Admin interface for exercise videos"""
    list_display = ['title', 'tags', 'created_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['title', 'description', 'tags']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Video Information', {
            'fields': ('title', 'description', 'video_file')
        }),
        ('Organization', {
            'fields': ('tags',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(PracticeThread)
class PracticeThreadAdmin(admin.ModelAdmin):
    """Admin interface for practice threads"""
    list_display = ['title', 'exercise_video', 'created_at']
    list_filter = ['created_at', 'updated_at', 'exercise_video']
    search_fields = ['title', 'description', 'exercise_video__title']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Thread Information', {
            'fields': ('exercise_video', 'title', 'description', 'video_file')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
