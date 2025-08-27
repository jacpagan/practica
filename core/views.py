"""
Simplified core views for Practika v1
Essential video upload and management functionality only
"""

import os
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage

from django.conf import settings
from django.db import connection
from .models import VideoAsset
from .services.storage import VideoStorageService
from analytics.utils import track_video_view

logger = logging.getLogger(__name__)

def health_check(request):
    """Comprehensive health check endpoint for production monitoring"""
    import time
    start_time = time.time()
    
    try:
        health_data = {
            'status': 'healthy',
            'timestamp': time.time(),
            'version': '1.0.0',
            'environment': os.getenv('DJANGO_ENVIRONMENT', 'unknown'),
            'checks': {}
        }
        
        # Database health check
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                health_data['checks']['database'] = 'healthy'
        except Exception as e:
            health_data['checks']['database'] = f'unhealthy: {str(e)}'
            health_data['status'] = 'unhealthy'
        
        # Storage health check
        try:
            # Check if we can write to media directory
            media_dir = getattr(settings, 'MEDIA_ROOT', '/app/media')
            test_file = os.path.join(media_dir, 'health_check_test.txt')
            with open(test_file, 'w') as f:
                f.write('health check')
            os.remove(test_file)
            health_data['checks']['storage'] = 'healthy'
        except Exception as e:
            health_data['checks']['storage'] = f'unhealthy: {str(e)}'
            health_data['status'] = 'unhealthy'
        
        # Calculate response time
        response_time = (time.time() - start_time) * 1000
        health_data['response_time_ms'] = round(response_time, 2)
        
        # Return appropriate status code
        status_code = 200 if health_data['status'] == 'healthy' else 503
        
        return JsonResponse(health_data, status=status_code)
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': time.time()
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
@login_required
def upload_video(request):
    """Upload video file"""
    try:
        if 'video' not in request.FILES:
            return JsonResponse({'error': 'No video file provided'}, status=400)
        
        video_file = request.FILES['video']
        
        # Basic validation
        if video_file.size == 0:
            return JsonResponse({'error': 'File is empty'}, status=400)
        
        # Check file size (100MB limit)
        max_size = 100 * 1024 * 1024
        if video_file.size > max_size:
            return JsonResponse({
                'error': f'File too large ({video_file.size / 1024 / 1024:.1f}MB). Maximum is 100MB.'
            }, status=400)
        
        storage_service = VideoStorageService()
        video_asset = storage_service.store_uploaded_video(video_file)

        logger.info(f"Video uploaded successfully: {video_asset.id}")

        return JsonResponse({
            'success': True,
            'video_id': str(video_asset.id),
            'filename': video_file.name,
            'size': video_file.size,
            'mime_type': video_asset.mime_type
        })
        
    except Exception as e:
        logger.error(f"Video upload failed: {e}")
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
@login_required
def list_videos(request):
    """List all videos"""
    try:
        videos = VideoAsset.objects.all().order_by('-created_at')
        
        video_list = []
        for video in videos:
            track_video_view(request.user, video)
            video_list.append({
                'id': str(video.id),
                'filename': video.orig_filename,
                'size': video.size_bytes,
                'mime_type': video.mime_type,
                'status': video.processing_status,
                'created_at': video.created_at.isoformat(),
                'url': video.get_public_url()
            })
        
        return JsonResponse({'videos': video_list})
        
    except Exception as e:
        logger.error(f"Failed to list videos: {e}")
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["DELETE"])
@login_required
def delete_video(request, video_id):
    """Delete video"""
    try:
        video = VideoAsset.objects.get(id=video_id)
        
        # Delete file from storage
        storage_service = VideoStorageService()
        storage_service.delete_video(video.storage_path)
        
        # Delete database record
        video.delete()
        
        logger.info(f"Video deleted: {video_id}")
        return JsonResponse({'success': True})
        
    except VideoAsset.DoesNotExist:
        return JsonResponse({'error': 'Video not found'}, status=404)
    except Exception as e:
        logger.error(f"Failed to delete video: {e}")
        return JsonResponse({'error': str(e)}, status=500)

def _get_mime_type_from_extension(filename):
    """Get MIME type from file extension"""
    extension = os.path.splitext(filename)[1].lower()
    mime_map = {
        '.mp4': 'video/mp4',
        '.avi': 'video/avi',
        '.mov': 'video/mov',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg'
    }
    return mime_map.get(extension, 'video/mp4')
