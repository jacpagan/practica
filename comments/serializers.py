from rest_framework import serializers
from comments.models import VideoComment
from exercises.models import Exercise
from core.models import VideoAsset


class VideoCommentSerializer(serializers.ModelSerializer):
    video_asset = serializers.SerializerMethodField()
    video = serializers.FileField(write_only=True, required=False)
    exercise_id = serializers.UUIDField(write_only=True)
    
    class Meta:
        model = VideoComment
        fields = ['id', 'exercise', 'exercise_id', 'author', 'text', 'video_asset', 'video', 'created_at', 'updated_at']
        read_only_fields = ['id', 'exercise', 'author', 'created_at', 'updated_at']
    
    def get_video_asset(self, obj):
        """Return nested video asset data"""
        return {
            'id': obj.video_asset.id,
            'orig_filename': obj.video_asset.orig_filename,
            'mime_type': obj.video_asset.mime_type,
            'size_bytes': obj.video_asset.size_bytes,
            'duration_sec': obj.video_asset.duration_sec,
            'width': obj.video_asset.width,
            'height': obj.video_asset.height,
            'poster_path': obj.video_asset.poster_path,
            'created_at': obj.video_asset.created_at,
        }
    
    def create(self, validated_data):
        video_file = validated_data.pop('video', None)
        exercise_id = validated_data.pop('exercise_id')
        
        # Get exercise
        try:
            exercise = Exercise.objects.get(id=exercise_id)
        except Exercise.DoesNotExist:
            raise serializers.ValidationError("Exercise not found")
        
        # Create video asset (required)
        if not video_file:
            raise serializers.ValidationError("Video file is required for comments")
        
        from core.container import container
        storage_service = container.get_video_storage_service()
        video_asset = storage_service.store_uploaded_video(video_file)
        
        # Create comment
        validated_data['exercise'] = exercise
        validated_data['video_asset'] = video_asset
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        video_file = validated_data.pop('video', None)
        
        if video_file:
            # Replace video asset using dependency injection
            from core.container import container
            storage_service = container.get_video_storage_service()
            
            # Store the old video asset reference
            old_video_asset = instance.video_asset
            
            # Create new video asset
            video_asset = storage_service.store_uploaded_video(video_file)
            validated_data['video_asset'] = video_asset
            
            # Update the instance
            result = super().update(instance, validated_data)
            
            # Now delete old video asset if it's different
            if old_video_asset and old_video_asset.id != video_asset.id:
                storage_service.delete_video_asset(old_video_asset)
            
            return result
        
        return super().update(instance, validated_data)
