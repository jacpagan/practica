from rest_framework import serializers
from .models import Exercise, Session, Chapter


class ExerciseSerializer(serializers.ModelSerializer):
    chapter_count = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ['id', 'name', 'category', 'description', 'created_at', 'chapter_count']
        read_only_fields = ['id', 'created_at', 'chapter_count']

    def get_chapter_count(self, obj):
        return obj.chapters.count()


class ChapterSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True, default=None)

    class Meta:
        model = Chapter
        fields = [
            'id', 'session', 'exercise', 'exercise_name',
            'title', 'timestamp_seconds', 'end_seconds', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SessionSerializer(serializers.ModelSerializer):
    chapters = ChapterSerializer(many=True, read_only=True)
    chapter_count = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'title', 'description', 'video_file',
            'duration_seconds', 'recorded_at', 'created_at', 'updated_at',
            'chapters', 'chapter_count',
        ]
        read_only_fields = ['id', 'recorded_at', 'created_at', 'updated_at']

    def get_chapter_count(self, obj):
        return obj.chapters.count()


class SessionListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views (no nested chapters)."""
    chapter_count = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'title', 'description', 'video_file',
            'duration_seconds', 'recorded_at', 'created_at',
            'chapter_count',
        ]
        read_only_fields = ['id', 'recorded_at', 'created_at']

    def get_chapter_count(self, obj):
        return obj.chapters.count()


class ProgressChapterSerializer(serializers.ModelSerializer):
    """Chapter with session info for the progress view."""
    session_title = serializers.CharField(source='session.title', read_only=True)
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    session_video = serializers.FileField(source='session.video_file', read_only=True)
    session_date = serializers.DateTimeField(source='session.recorded_at', read_only=True)

    class Meta:
        model = Chapter
        fields = [
            'id', 'timestamp_seconds', 'end_seconds', 'notes',
            'session_id', 'session_title', 'session_video', 'session_date', 'created_at',
        ]
