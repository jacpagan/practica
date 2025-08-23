from rest_framework import serializers
from exercises.models import Exercise
from core.models import VideoAsset


class VideoAssetSerializer(serializers.ModelSerializer):
    """Read-only serializer for video assets"""
    
    class Meta:
        model = VideoAsset
        fields = ['id', 'orig_filename', 'mime_type', 'size_bytes', 'duration_sec', 'width', 'height', 'poster_path', 'created_at']
        read_only_fields = fields


class ExerciseSerializer(serializers.ModelSerializer):
    video_asset = VideoAssetSerializer(read_only=True)
    video = serializers.FileField(write_only=True, required=False)
    
    class Meta:
        model = Exercise
        fields = ['id', 'name', 'description', 'video_asset', 'video', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        video_file = validated_data.pop('video', None)
        if not video_file:
            raise serializers.ValidationError("Video file is required")
        
        # Create video asset first
        from core.services.storage import VideoStorageService
        storage_service = VideoStorageService()
        video_asset = storage_service.store_uploaded_video(video_file)
        
        # Create exercise
        validated_data['video_asset'] = video_asset
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        video_file = validated_data.pop('video', None)
        
        if video_file:
            # Replace video asset
            from core.services.storage import VideoStorageService
            storage_service = VideoStorageService()
            
            # Delete old video asset
            if instance.video_asset:
                storage_service.delete_video_asset(instance.video_asset)
            
            # Create new video asset
            video_asset = storage_service.store_uploaded_video(video_file)
            validated_data['video_asset'] = video_asset
        
        return super().update(instance, validated_data)
