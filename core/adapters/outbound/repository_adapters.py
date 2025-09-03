"""
Repository adapters - Connect domain entities to Django ORM
"""

import uuid
from typing import List, Optional
from django.core.exceptions import ObjectDoesNotExist

from ...domain.entities import VideoAsset, Exercise, VideoComment
from ...domain.value_objects import UserId, FileInfo, VideoMetadata, ProcessingStatus
from ...ports.outbound.repository_ports import VideoAssetRepository, ExerciseRepository, CommentRepository

# Import Django models
from core.models import VideoAsset as DjangoVideoAsset
from exercises.models import Exercise as DjangoExercise
from comments.models import VideoComment as DjangoVideoComment


class DjangoVideoAssetRepository(VideoAssetRepository):
    """
    Django ORM adapter for VideoAsset repository
    Converts between domain entities and Django models
    """
    
    def save(self, video_asset: VideoAsset) -> VideoAsset:
        """Save video asset to database"""
        try:
            # Find existing Django model
            django_model = DjangoVideoAsset.objects.get(id=video_asset.id)
            
            # Update fields
            django_model.orig_filename = video_asset.file_info.original_filename
            django_model.storage_path = video_asset.storage_path
            django_model.mime_type = video_asset.file_info.mime_type
            django_model.size_bytes = video_asset.file_info.size_bytes
            django_model.checksum_sha256 = video_asset.file_info.checksum_sha256
            django_model.poster_path = video_asset.poster_path
            django_model.processing_status = video_asset.processing_status.state.value
            django_model.processing_error = video_asset.processing_status.error_message
            django_model.is_valid = video_asset.is_valid
            django_model.validation_errors = video_asset.validation_errors
            django_model.access_count = video_asset.access_count
            django_model.last_accessed = video_asset.last_accessed
            django_model.updated_at = video_asset.updated_at
            
            # Update video metadata if available
            if video_asset.video_metadata:
                django_model.duration_sec = video_asset.video_metadata.duration_sec
                django_model.width = video_asset.video_metadata.width
                django_model.height = video_asset.video_metadata.height
            
            django_model.save()
            
        except ObjectDoesNotExist:
            # Create new Django model
            django_model = DjangoVideoAsset.objects.create(
                id=video_asset.id,
                orig_filename=video_asset.file_info.original_filename,
                storage_path=video_asset.storage_path,
                mime_type=video_asset.file_info.mime_type,
                size_bytes=video_asset.file_info.size_bytes,
                checksum_sha256=video_asset.file_info.checksum_sha256,
                poster_path=video_asset.poster_path,
                processing_status=video_asset.processing_status.state.value,
                processing_error=video_asset.processing_status.error_message,
                is_valid=video_asset.is_valid,
                validation_errors=video_asset.validation_errors,
                access_count=video_asset.access_count,
                last_accessed=video_asset.last_accessed,
                created_at=video_asset.created_at,
                updated_at=video_asset.updated_at,
                # Video metadata
                duration_sec=video_asset.video_metadata.duration_sec if video_asset.video_metadata else None,
                width=video_asset.video_metadata.width if video_asset.video_metadata else None,
                height=video_asset.video_metadata.height if video_asset.video_metadata else None
            )
        
        # Return domain entity
        return self._to_domain_entity(django_model)
    
    def find_by_id(self, video_id: uuid.UUID) -> Optional[VideoAsset]:
        """Find video asset by ID"""
        try:
            django_model = DjangoVideoAsset.objects.get(id=video_id)
            return self._to_domain_entity(django_model)
        except ObjectDoesNotExist:
            return None
    
    def find_all(self) -> List[VideoAsset]:
        """Find all video assets"""
        django_models = DjangoVideoAsset.objects.all()
        return [self._to_domain_entity(model) for model in django_models]
    
    def find_by_processing_status(self, status: str) -> List[VideoAsset]:
        """Find video assets by processing status"""
        django_models = DjangoVideoAsset.objects.filter(processing_status=status)
        return [self._to_domain_entity(model) for model in django_models]
    
    def delete(self, video_id: uuid.UUID) -> None:
        """Delete video asset"""
        try:
            DjangoVideoAsset.objects.get(id=video_id).delete()
        except ObjectDoesNotExist:
            pass
    
    def _to_domain_entity(self, django_model: DjangoVideoAsset) -> VideoAsset:
        """Convert Django model to domain entity"""
        # Create FileInfo value object
        file_info = FileInfo(
            original_filename=django_model.orig_filename,
            mime_type=django_model.mime_type,
            size_bytes=django_model.size_bytes,
            checksum_sha256=django_model.checksum_sha256
        )
        
        # Create VideoMetadata value object if available
        video_metadata = None
        if django_model.duration_sec or django_model.width or django_model.height:
            video_metadata = VideoMetadata(
                duration_sec=django_model.duration_sec,
                width=django_model.width,
                height=django_model.height
            )
        
        # Create ProcessingStatus value object
        processing_status = ProcessingStatus(
            state=ProcessingStatus.ProcessingState(django_model.processing_status),
            error_message=django_model.processing_error
        )
        
        # Create domain entity
        return VideoAsset(
            id=django_model.id,
            file_info=file_info,
            storage_path=django_model.storage_path,
            video_metadata=video_metadata,
            poster_path=django_model.poster_path,
            processing_status=processing_status,
            is_valid=django_model.is_valid,
            validation_errors=django_model.validation_errors or [],
            access_count=django_model.access_count,
            last_accessed=django_model.last_accessed,
            created_at=django_model.created_at,
            updated_at=django_model.updated_at
        )


class DjangoExerciseRepository(ExerciseRepository):
    """
    Django ORM adapter for Exercise repository
    Converts between domain entities and Django models
    """
    
    def save(self, exercise: Exercise) -> Exercise:
        """Save exercise to database"""
        try:
            # Find existing Django model
            django_model = DjangoExercise.objects.get(id=exercise.id)
            
            # Update fields
            django_model.name = exercise.name
            django_model.description = exercise.description
            django_model.video_asset_id = exercise.video_asset_id
            django_model.created_by_id = exercise.created_by.value
            django_model.updated_at = exercise.updated_at
            
            django_model.save()
            
        except ObjectDoesNotExist:
            # Create new Django model
            django_model = DjangoExercise.objects.create(
                id=exercise.id,
                name=exercise.name,
                description=exercise.description,
                video_asset_id=exercise.video_asset_id,
                created_by_id=exercise.created_by.value,
                created_at=exercise.created_at,
                updated_at=exercise.updated_at
            )
        
        # Return domain entity
        return self._to_domain_entity(django_model)
    
    def find_by_id(self, exercise_id: uuid.UUID) -> Optional[Exercise]:
        """Find exercise by ID"""
        try:
            django_model = DjangoExercise.objects.get(id=exercise_id)
            return self._to_domain_entity(django_model)
        except ObjectDoesNotExist:
            return None
    
    def find_all(self) -> List[Exercise]:
        """Find all exercises"""
        django_models = DjangoExercise.objects.all()
        return [self._to_domain_entity(model) for model in django_models]
    
    def find_by_creator(self, creator_id: UserId) -> List[Exercise]:
        """Find exercises by creator"""
        django_models = DjangoExercise.objects.filter(created_by_id=creator_id.value)
        return [self._to_domain_entity(model) for model in django_models]
    
    def find_by_video_asset(self, video_asset_id: uuid.UUID) -> List[Exercise]:
        """Find exercises by video asset"""
        django_models = DjangoExercise.objects.filter(video_asset_id=video_asset_id)
        return [self._to_domain_entity(model) for model in django_models]
    
    def delete(self, exercise_id: uuid.UUID) -> None:
        """Delete exercise"""
        try:
            DjangoExercise.objects.get(id=exercise_id).delete()
        except ObjectDoesNotExist:
            pass
    
    def _to_domain_entity(self, django_model: DjangoExercise) -> Exercise:
        """Convert Django model to domain entity"""
        return Exercise(
            id=django_model.id,
            name=django_model.name,
            description=django_model.description,
            video_asset_id=django_model.video_asset_id,
            created_by=UserId.from_uuid(django_model.created_by_id),
            created_at=django_model.created_at,
            updated_at=django_model.updated_at
        )


class DjangoCommentRepository(CommentRepository):
    """
    Django ORM adapter for VideoComment repository
    Converts between domain entities and Django models
    """
    
    def save(self, comment: VideoComment) -> VideoComment:
        """Save comment to database"""
        try:
            # Find existing Django model
            django_model = DjangoVideoComment.objects.get(id=comment.id)
            
            # Update fields
            django_model.exercise_id = comment.exercise_id
            django_model.author_id = comment.author_id.value
            django_model.text = comment.text
            django_model.video_asset_id = comment.video_asset_id
            django_model.updated_at = comment.updated_at
            
            django_model.save()
            
        except ObjectDoesNotExist:
            # Create new Django model
            django_model = DjangoVideoComment.objects.create(
                id=comment.id,
                exercise_id=comment.exercise_id,
                author_id=comment.author_id.value,
                text=comment.text,
                video_asset_id=comment.video_asset_id,
                created_at=comment.created_at,
                updated_at=comment.updated_at
            )
        
        # Return domain entity
        return self._to_domain_entity(django_model)
    
    def find_by_id(self, comment_id: uuid.UUID) -> Optional[VideoComment]:
        """Find comment by ID"""
        try:
            django_model = DjangoVideoComment.objects.get(id=comment_id)
            return self._to_domain_entity(django_model)
        except ObjectDoesNotExist:
            return None
    
    def find_all(self) -> List[VideoComment]:
        """Find all comments"""
        django_models = DjangoVideoComment.objects.all()
        return [self._to_domain_entity(model) for model in django_models]
    
    def find_by_exercise(self, exercise_id: uuid.UUID) -> List[VideoComment]:
        """Find comments by exercise"""
        django_models = DjangoVideoComment.objects.filter(exercise_id=exercise_id)
        return [self._to_domain_entity(model) for model in django_models]
    
    def find_by_author(self, author_id: UserId) -> List[VideoComment]:
        """Find comments by author"""
        django_models = DjangoVideoComment.objects.filter(author_id=author_id.value)
        return [self._to_domain_entity(model) for model in django_models]
    
    def find_by_video_asset(self, video_asset_id: uuid.UUID) -> List[VideoComment]:
        """Find comments by video asset"""
        django_models = DjangoVideoComment.objects.filter(video_asset_id=video_asset_id)
        return [self._to_domain_entity(model) for model in django_models]
    
    def delete(self, comment_id: uuid.UUID) -> None:
        """Delete comment"""
        try:
            DjangoVideoComment.objects.get(id=comment_id).delete()
        except ObjectDoesNotExist:
            pass
    
    def _to_domain_entity(self, django_model: DjangoVideoComment) -> VideoComment:
        """Convert Django model to domain entity"""
        return VideoComment(
            id=django_model.id,
            exercise_id=django_model.exercise_id,
            author_id=UserId.from_uuid(django_model.author_id),
            text=django_model.text,
            video_asset_id=django_model.video_asset_id,
            created_at=django_model.created_at,
            updated_at=django_model.updated_at
        )
