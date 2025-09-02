# Serializers for Practika MVP API
from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.playlists.models import Playlist
from apps.videos.models import Video

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'role', 'avatar', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name', 'password', 'password_confirm']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class VideoSerializer(serializers.ModelSerializer):
    """Serializer for Video model"""
    file_url = serializers.ReadOnlyField()
    file_size_mb = serializers.ReadOnlyField()
    
    class Meta:
        model = Video
        fields = [
            'id', 'playlist', 'title', 'description', 'tags', 
            'file', 'file_url', 'duration', 'trust_score', 
            'file_size_mb', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'file_url', 'trust_score', 'file_size_mb', 'created_at', 'updated_at']
    
    def validate_file(self, value):
        """Validate video file"""
        import os
        from django.conf import settings
        
        # Check file size
        if value.size > settings.VIDEO_UPLOAD_MAX_SIZE:
            raise serializers.ValidationError(f"File size must be under {settings.VIDEO_UPLOAD_MAX_SIZE / (1024*1024)}MB")
        
        # Check file extension
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
            raise serializers.ValidationError(f"Only {', '.join(settings.ALLOWED_VIDEO_EXTENSIONS)} files are allowed")
        
        return value


class PlaylistSerializer(serializers.ModelSerializer):
    """Serializer for Playlist model"""
    videos = VideoSerializer(many=True, read_only=True)
    video_count = serializers.ReadOnlyField()
    total_duration = serializers.ReadOnlyField()
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Playlist
        fields = [
            'id', 'user', 'title', 'description', 'tags', 'privacy',
            'trust_score', 'trust_level', 'videos', 'video_count',
            'total_duration', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'trust_score', 'trust_level', 'video_count', 'total_duration', 'created_at', 'updated_at']


class PlaylistCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating playlists"""
    class Meta:
        model = Playlist
        fields = ['title', 'description', 'tags', 'privacy']


class PublicPlaylistSerializer(serializers.ModelSerializer):
    """Serializer for public playlist viewing"""
    user = UserSerializer(read_only=True)
    video_count = serializers.ReadOnlyField()
    total_duration = serializers.ReadOnlyField()
    
    class Meta:
        model = Playlist
        fields = [
            'id', 'user', 'title', 'description', 'tags', 'trust_score',
            'trust_level', 'video_count', 'total_duration', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'trust_score', 'trust_level', 'video_count', 'total_duration', 'created_at']
