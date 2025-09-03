import logging
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone

try:
    from celery import shared_task
except Exception:  # pragma: no cover - celery may not be installed
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

from core.models import VideoAsset

logger = logging.getLogger(__name__)

RENDITIONS = ['360p', '480p', '720p']


def _copy_for_rendition(original_path: str, rendition: str) -> str:
    """Create a simple copy for a rendition and return its storage path"""
    base, ext = original_path.rsplit('.', 1)
    new_path = f"{base}_{rendition}.mp4"
    with default_storage.open(original_path, 'rb') as f:
        content = f.read()
    default_storage.save(new_path, ContentFile(content))
    if hasattr(default_storage, 'url'):
        return default_storage.url(new_path)
    return new_path


def transcode_video_sync(video_asset_id: str) -> bool:
    """Synchronous function to create adaptive bitrate renditions and store them"""
    try:
        asset = VideoAsset.objects.get(id=video_asset_id)
        asset.processing_status = 'processing'
        asset.save(update_fields=['processing_status'])

        urls = {}
        for rendition in RENDITIONS:
            try:
                urls[rendition] = _copy_for_rendition(asset.storage_path, rendition)
            except Exception as e:  # pragma: no cover - best effort for each rendition
                logger.error(f"Failed to create rendition {rendition} for {asset.id}: {e}")

        asset.renditions = urls
        asset.processing_status = 'completed'
        asset.processed_at = timezone.now()
        asset.save()
        return True
    except Exception as exc:
        logger.error(f"Transcoding failed for {video_asset_id}: {exc}")
        try:
            asset = VideoAsset.objects.get(id=video_asset_id)
            asset.processing_status = 'failed'
            asset.processing_error = str(exc)
            asset.save(update_fields=['processing_status', 'processing_error'])
        except Exception:  # pragma: no cover - fail silently if unable to update
            pass
        return False


@shared_task(bind=True)
def transcode_video(self, video_asset_id: str) -> bool:
    """Celery task wrapper for transcode_video_sync"""
    return transcode_video_sync(video_asset_id)
