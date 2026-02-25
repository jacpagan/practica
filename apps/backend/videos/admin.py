from django.contrib import admin
from .models import Profile, Exercise, Session, Chapter, Comment, TeacherStudent, InviteCode


class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 0
    raw_id_fields = ['exercise']


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    raw_id_fields = ['user']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'display_name']
    list_filter = ['role']


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'created_at']
    search_fields = ['name', 'category']


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'recorded_at', 'chapter_count']
    search_fields = ['title', 'description']
    list_filter = ['user']
    inlines = [ChapterInline, CommentInline]

    def chapter_count(self, obj):
        return obj.chapters.count()
    chapter_count.short_description = 'Chapters'


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


@admin.register(TeacherStudent)
class TeacherStudentAdmin(admin.ModelAdmin):
    list_display = ['teacher', 'student', 'created_at']
    raw_id_fields = ['teacher', 'student']


@admin.register(InviteCode)
class InviteCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'created_by', 'used_by', 'created_at']
    list_filter = ['created_at']
