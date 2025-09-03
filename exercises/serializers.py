from rest_framework import serializers
from exercises.models import Exercise
from core.models import VideoAsset


class VideoAssetSerializer(serializers.ModelSerializer):
    """Read-only serializer for video assets"""
    
    class Meta:
        model = VideoAsset
        fields = ['id', 'orig_filename', 'mime_type', 'size_bytes', 'duration_sec', 'width', 'height', 'poster_path', 'renditions', 'processing_status', 'created_at']
        read_only_fields = fields


class ExerciseSerializer(serializers.ModelSerializer):
    video_asset = VideoAssetSerializer(read_only=True)
    video = serializers.FileField(write_only=True, required=False)
    youtube_url = serializers.URLField(write_only=True, required=False)
    
    class Meta:
        model = Exercise
        fields = ['id', 'name', 'description', 'video_asset', 'video', 'youtube_url', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        video_file = validated_data.pop('video', None)
        youtube_url = validated_data.pop('youtube_url', None)
        
        if not video_file and not youtube_url:
            raise serializers.ValidationError("Either video file or YouTube URL is required")
        
        if video_file and youtube_url:
            raise serializers.ValidationError("Please provide either video file or YouTube URL, not both")
        
        # Create video asset using dependency injection
        from core.container import container
        storage_service = container.get_video_storage_service()
        
        if video_file:
            # Create video asset for uploaded file
            video_asset = storage_service.store_uploaded_video(video_file)
        else:
            # Create video asset for YouTube URL
            video_asset = storage_service.create_youtube_video_asset(youtube_url)
        
        # Create exercise
        validated_data['video_asset'] = video_asset
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        video_file = validated_data.pop('video', None)
        
        if video_file:
            # Replace video asset using dependency injection
            from core.container import container
            storage_service = container.get_video_storage_service()
            
            # Delete old video asset
            if instance.video_asset:
                storage_service.delete_video_asset(instance.video_asset)
            
            # Create new video asset
            video_asset = storage_service.store_uploaded_video(video_file)
            validated_data['video_asset'] = video_asset
        
        return super().update(instance, validated_data)
