"""
Serializers for your personal practice tracking system.
"""

from rest_framework import serializers
from .models import ExerciseVideo, PracticeThread

class PracticeThreadSerializer(serializers.ModelSerializer):
    """Serializer for practice threads"""
    
    class Meta:
        model = PracticeThread
        fields = ['id', 'title', 'description', 'video_file', 'time_of_day', 'created_at', 'updated_at']
        read_only_fields = ['id', 'time_of_day', 'created_at', 'updated_at']

class ExerciseVideoSerializer(serializers.ModelSerializer):
    """Serializer for exercise videos with practice threads"""
    practice_threads = PracticeThreadSerializer(many=True, read_only=True)
    
    class Meta:
        model = ExerciseVideo
        fields = ['id', 'title', 'description', 'video_file', 'tags', 'time_of_day', 'created_at', 'updated_at', 'practice_threads']
        read_only_fields = ['id', 'time_of_day', 'created_at', 'updated_at']