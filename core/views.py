"""
Simplified core views for Practika v1
Essential video upload and management functionality only
"""

import os
import time
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
from .services.video_clip_service import video_clip_service

logger = logging.getLogger(__name__)

def health_check(request):
    """Health check endpoint for production monitoring"""
    
    start_time = time.time()
    
    checks = {}
    
    try:
        # Database connectivity check
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            checks['database'] = 'healthy'
    except Exception as e:
        checks['database'] = f'error: {str(e)}'
    
    try:
        # Storage check
        from django.core.files.storage import default_storage
        if hasattr(default_storage, 'bucket_name'):
            checks['storage'] = 'healthy'
        else:
            checks['storage'] = 'local'
    except Exception as e:
        checks['storage'] = f'error: {str(e)}'
    
    response_time = (time.time() - start_time) * 1000
    
    return JsonResponse({
        'status': 'healthy',
        'timestamp': time.time(),
        'version': '1.0.0',
        'environment': getattr(settings, 'ENVIRONMENT', 'unknown'),
        'checks': checks,
        'response_time_ms': round(response_time, 2)
    })


def signup_debug(request):
    """Debug endpoint to test signup components"""
    if not settings.DEBUG and getattr(settings, 'ENVIRONMENT', '') != 'production':
        return JsonResponse({'error': 'Not available'}, status=404)
    
    checks = {}
    
    try:
        # Test Role model import and data
        from accounts.models import Role
        roles = list(Role.objects.all().values_list('name', flat=True))
        checks['roles'] = {'status': 'ok', 'available_roles': roles}
    except Exception as e:
        checks['roles'] = {'status': 'error', 'error': str(e)}
    
    try:
        # Test Profile model import
        from accounts.models import Profile
        profile_count = Profile.objects.count()
        checks['profiles'] = {'status': 'ok', 'count': profile_count}
    except Exception as e:
        checks['profiles'] = {'status': 'error', 'error': str(e)}
    
    try:
        # Test User model
        from django.contrib.auth.models import User
        user_count = User.objects.count()
        checks['users'] = {'status': 'ok', 'count': user_count}
    except Exception as e:
        checks['users'] = {'status': 'error', 'error': str(e)}
    
    try:
        # Test URL resolution
        from django.urls import reverse
        student_url = reverse('accounts:student_dashboard')
        teacher_url = reverse('accounts:teacher_dashboard')
        checks['urls'] = {'status': 'ok', 'student_url': student_url, 'teacher_url': teacher_url}
    except Exception as e:
        checks['urls'] = {'status': 'error', 'error': str(e)}
    
    return JsonResponse({
        'status': 'debug',
        'timestamp': time.time(),
        'checks': checks
    })

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


@csrf_exempt
@require_http_methods(["POST"])
@login_required
def create_clip(request):
    """Create a video clip with idempotency"""
    try:
        import json
        data = json.loads(request.body)
        
        video_id = data.get('video_id')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        destination = data.get('destination', 'exercise')
        
        # Validate required fields
        if not all([video_id, start_time is not None, end_time is not None]):
            return JsonResponse({
                'error': 'Missing required fields: video_id, start_time, end_time'
            }, status=400)
        
        # Validate time values
        try:
            start_time = float(start_time)
            end_time = float(end_time)
        except (ValueError, TypeError):
            return JsonResponse({
                'error': 'start_time and end_time must be valid numbers'
            }, status=400)
        
        # Get video asset
        try:
            video_asset = VideoAsset.objects.get(id=video_id)
        except VideoAsset.DoesNotExist:
            return JsonResponse({'error': 'Video not found'}, status=404)
        
        # Create clip
        clip = video_clip_service.create_clip(
            video_asset=video_asset,
            start_time=start_time,
            end_time=end_time,
            destination=destination
        )
        
        logger.info(f"Clip created successfully: {clip.id}")
        
        return JsonResponse({
            'success': True,
            'clip_id': str(clip.id),
            'clip_hash': clip.clip_hash,
            'start_time': clip.start_time,
            'end_time': clip.end_time,
            'duration': clip.duration,
            'status': clip.processing_status,
            'url': clip.get_public_url() if clip.processing_status == 'completed' else None
        })
        
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        logger.error(f"Clip creation failed: {e}")
        return JsonResponse({'error': str(e)}, status=500)
