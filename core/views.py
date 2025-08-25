import logging
import time
import psutil
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
from django.db import connection
from django.core.cache import cache
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import json
from django.shortcuts import render

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Comprehensive health check endpoint for the Practika system
    """
    start_time = time.time()
    health_status = {
        'status': 'healthy',
        'timestamp': time.time(),
        'request_id': getattr(request, 'request_id', 'unknown'),
        'version': '1.0.0',
        'environment': getattr(settings, 'ENVIRONMENT', 'unknown'),
        'checks': {}
    }
    
    # Database health check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            db_status = 'healthy'
            db_response_time = 0
        health_status['checks']['database'] = {
            'status': db_status,
            'response_time': db_response_time,
            'connection_pool': getattr(connection, 'connection', None) is not None
        }
    except Exception as e:
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'error': str(e),
            'response_time': None
        }
        health_status['status'] = 'unhealthy'
        logger.error(f"Database health check failed: {e}")
    
    # Cache health check
    try:
        cache_start = time.time()
        cache.set('health_check', 'test', 10)
        cache_value = cache.get('health_check')
        cache.delete('health_check')
        cache_response_time = time.time() - cache_start
        
        if cache_value == 'test':
            cache_status = 'healthy'
        else:
            cache_status = 'unhealthy'
            
        health_status['checks']['cache'] = {
            'status': cache_status,
            'response_time': cache_response_time,
            'backend': settings.CACHES['default']['BACKEND']
        }
    except Exception as e:
        health_status['checks']['cache'] = {
            'status': 'unhealthy',
            'error': str(e),
            'response_time': None
        }
        health_status['status'] = 'unhealthy'
        logger.error(f"Cache health check failed: {e}")
    
    # Storage health check
    try:
        storage_path = settings.MEDIA_ROOT
        if os.path.exists(storage_path):
            storage_info = os.statvfs(storage_path)
            free_space = storage_info.f_frsize * storage_info.f_bavail
            total_space = storage_info.f_frsize * storage_info.f_blocks
            free_percentage = (free_space / total_space) * 100
            
            storage_status = 'healthy' if free_percentage > 10 else 'warning'
            health_status['checks']['storage'] = {
                'status': storage_status,
                'free_space_gb': round(free_space / (1024**3), 2),
                'total_space_gb': round(total_space / (1024**3), 2),
                'free_percentage': round(free_percentage, 2),
                'path': str(storage_path)
            }
            
            if free_percentage <= 10:
                health_status['status'] = 'warning'
        else:
            health_status['checks']['storage'] = {
                'status': 'unhealthy',
                'error': 'Storage path does not exist',
                'path': str(storage_path)
            }
            health_status['status'] = 'unhealthy'
    except Exception as e:
        health_status['checks']['storage'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        health_status['status'] = 'unhealthy'
        logger.error(f"Storage health check failed: {e}")
    
    # System metrics
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_status['checks']['system'] = {
            'status': 'healthy',
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'memory_available_gb': round(memory.available / (1024**3), 2),
            'disk_percent': disk.percent,
            'disk_free_gb': round(disk.free / (1024**3), 2)
        }
        
        # Check for high resource usage
        if cpu_percent > 80 or memory.percent > 80 or disk.percent > 90:
            health_status['status'] = 'warning'
            
    except Exception as e:
        health_status['checks']['system'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        health_status['status'] = 'unhealthy'
        logger.error(f"System metrics check failed: {e}")
    
    # Overall response time
    health_status['response_time'] = time.time() - start_time
    
    # Set appropriate HTTP status
    if health_status['status'] == 'healthy':
        http_status = status.HTTP_200_OK
    elif health_status['status'] == 'warning':
        http_status = status.HTTP_200_OK
    else:
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
    
    logger.info(f"Health check completed: {health_status['status']} in {health_status['response_time']:.4f}s")
    
    return Response(health_status, status=http_status)


@api_view(['GET'])
@permission_classes([AllowAny])
def system_status(request):
    """
    Detailed system status and metrics
    """
    status_data = {
        'timestamp': time.time(),
        'request_id': getattr(request, 'request_id', 'unknown'),
        'environment': getattr(settings, 'ENVIRONMENT', 'unknown'),
        'debug': settings.DEBUG,
        'allowed_hosts': settings.ALLOWED_HOSTS,
        'database': {},
        'cache': {},
        'storage': {},
        'system': {},
        'performance': {}
    }
    
    # Database status
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT sqlite_version()" if 'sqlite' in settings.DATABASES['default']['ENGINE'] else "SELECT version()")
            version = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'" if 'sqlite' in settings.DATABASES['default']['ENGINE'] else "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
            table_count = cursor.fetchone()[0]
            
        status_data['database'] = {
            'engine': settings.DATABASES['default']['ENGINE'],
            'name': str(settings.DATABASES['default']['NAME']),
            'version': version,
            'table_count': table_count,
            'connection_active': getattr(connection, 'connection', None) is not None
        }
    except Exception as e:
        status_data['database'] = {'error': str(e)}
    
    # Cache status
    try:
        cache_info = cache.get_many(['test_key'])
        status_data['cache'] = {
            'backend': settings.CACHES['default']['BACKEND'],
            'location': settings.CACHES['default']['LOCATION'],
            'timeout': settings.CACHES['default']['TIMEOUT'],
            'working': True
        }
    except Exception as e:
        status_data['cache'] = {'error': str(e)}
    
    # Storage status
    try:
        storage_path = settings.MEDIA_ROOT
        if os.path.exists(storage_path):
            storage_info = os.statvfs(storage_path)
            status_data['storage'] = {
                'path': str(storage_path),
                'free_space_gb': round(storage_info.f_frsize * storage_info.f_bavail / (1024**3), 2),
                'total_space_gb': round(storage_info.f_frsize * storage_info.f_blocks / (1024**3), 2),
                'inodes_free': storage_info.f_ffree,
                'inodes_total': storage_info.f_files
            }
        else:
            status_data['storage'] = {'error': 'Storage path does not exist'}
    except Exception as e:
        status_data['storage'] = {'error': str(e)}
    
    # System metrics
    try:
        status_data['system'] = {
            'cpu_count': psutil.cpu_count(),
            'cpu_percent': psutil.cpu_percent(interval=0.1),
            'memory_total_gb': round(psutil.virtual_memory().total / (1024**3), 2),
            'memory_available_gb': round(psutil.virtual_memory().available / (1024**3), 2),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_total_gb': round(psutil.disk_usage('/').total / (1024**3), 2),
            'disk_free_gb': round(psutil.disk_usage('/').free / (1024**3), 2),
            'disk_percent': psutil.disk_usage('/').percent
        }
    except Exception as e:
        status_data['system'] = {'error': str(e)}
    
    # Performance metrics
    try:
        if hasattr(connection, 'queries'):
            status_data['performance'] = {
                'total_queries': len(connection.queries),
                'slow_queries': len([q for q in connection.queries if float(q.get('time', 0)) > 1.0]),
                'total_query_time': sum(float(q.get('time', 0)) for q in connection.queries)
            }
        else:
            status_data['performance'] = {'note': 'Query logging not enabled'}
    except Exception as e:
        status_data['performance'] = {'error': str(e)}
    
    return Response(status_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def metrics(request):
    """
    Prometheus-style metrics endpoint
    """
    metrics_data = []
    
    # System metrics
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        metrics_data.extend([
            f'# HELP practika_cpu_percent CPU usage percentage',
            f'# TYPE practika_cpu_percent gauge',
            f'practika_cpu_percent {cpu_percent}',
            '',
            f'# HELP practika_memory_percent Memory usage percentage',
            f'# TYPE practika_memory_percent gauge',
            f'practika_memory_percent {memory.percent}',
            '',
            f'# HELP practika_memory_bytes Memory usage in bytes',
            f'# TYPE practika_memory_bytes gauge',
            f'practika_memory_bytes {memory.used}',
            '',
            f'# HELP practika_disk_percent Disk usage percentage',
            f'# TYPE practika_disk_percent gauge',
            f'practika_disk_percent {disk.percent}',
            '',
            f'# HELP practika_disk_free_bytes Free disk space in bytes',
            f'# TYPE practika_disk_free_bytes gauge',
            f'practika_disk_free_bytes {disk.free}',
        ])
    except Exception as e:
        logger.error(f"Failed to collect system metrics: {e}")
    
    # Database metrics
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'" if 'sqlite' in settings.DATABASES['default']['ENGINE'] else "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
            table_count = cursor.fetchone()[0]
            
        metrics_data.extend([
            '',
            f'# HELP practika_database_tables Total number of database tables',
            f'# TYPE practika_database_tables gauge',
            f'practika_database_tables {table_count}',
        ])
    except Exception as e:
        logger.error(f"Failed to collect database metrics: {e}")
    
    # Storage metrics
    try:
        storage_path = settings.MEDIA_ROOT
        if os.path.exists(storage_path):
            storage_info = os.statvfs(storage_path)
            free_space = storage_info.f_frsize * storage_info.f_bavail
            total_space = storage_info.f_frsize * storage_info.f_blocks
            
            metrics_data.extend([
                '',
                            f'# HELP practika_storage_free_bytes Free storage space in bytes',
            f'# TYPE practika_storage_free_bytes gauge',
            f'practika_storage_free_bytes {free_space}',
                '',
                            f'# HELP practika_storage_total_bytes Total storage space in bytes',
            f'# TYPE practika_storage_total_bytes gauge',
            f'practika_storage_total_bytes {total_space}',
            ])
    except Exception as e:
        logger.error(f"Failed to collect storage metrics: {e}")
    
    # Request metrics
    request_id = getattr(request, 'request_id', 'unknown')
    metrics_data.extend([
        '',
        f'# HELP practika_request_id Current request ID for correlation',
        f'# TYPE practika_request_id gauge',
        f'practika_request_id{{id="{request_id}"}} 1',
    ])
    
    return Response('\n'.join(metrics_data), content_type='text/plain')


@api_view(['GET'])
@permission_classes([AllowAny])
def logs(request):
    """
    Recent log entries (for debugging purposes)
    """
    if not settings.DEBUG:
        return Response({'error': 'Log access not available in production'}, status=status.HTTP_403_FORBIDDEN)
    
    log_level = request.GET.get('level', 'INFO').upper()
    limit = min(int(request.GET.get('limit', 100)), 1000)  # Max 1000 entries
    
    try:
        log_file = settings.BASE_DIR / 'logs' / 'django.log'
        if not log_file.exists():
            return Response({'error': 'Log file not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Read last N lines from log file
        with open(log_file, 'r') as f:
            lines = f.readlines()
            recent_lines = lines[-limit:] if len(lines) > limit else lines
        
        # Filter by log level if specified
        if log_level != 'ALL':
            filtered_lines = []
            for line in recent_lines:
                if log_level in line:
                    filtered_lines.append(line)
            recent_lines = filtered_lines
        
        return Response({
            'log_level': log_level,
            'limit': limit,
            'total_lines': len(recent_lines),
            'logs': recent_lines[-100:]  # Return last 100 lines max
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def upload_video(request):
    """
    Secure video upload endpoint leveraging existing VideoStorageService
    """
    try:
        # Check rate limiting using existing middleware
        client_ip = _get_client_ip(request)
        if not _check_upload_rate_limit(client_ip):
            return Response({
                'error': 'Upload rate limit exceeded. Please wait before uploading again.',
                'retry_after': 60
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        # Validate request has video file
        if 'video' not in request.FILES:
            return Response({
                'error': 'No video file provided. Please include a video file in the request.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        video_file = request.FILES['video']
        
        # Use existing security validation
        from core.security import SecurityValidator
        validation_result = SecurityValidator.validate_file_upload(
            filename=video_file.name,
            file_size=video_file.size,
            mime_type=video_file.content_type
        )
        
        if not validation_result['valid']:
            return Response({
                'error': 'File validation failed',
                'details': validation_result['errors'],
                'warnings': validation_result.get('warnings', [])
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Use existing VideoStorageService to store the video
        from core.services.storage import VideoStorageService
        storage_service = VideoStorageService()
        
        # Store video using existing service (handles S3/local fallback)
        video_asset = storage_service.store_uploaded_video(video_file, request.user)
        
        # Get video URL using existing service
        video_url = storage_service.get_video_url(video_asset)
        
        # Return success response with video details
        return Response({
            'success': True,
            'video_id': str(video_asset.id),
            'filename': video_asset.orig_filename,
            'size_bytes': video_asset.size_bytes,
            'mime_type': video_asset.mime_type,
            'url': video_url,
            'storage_path': video_asset.storage_path,
            'processing_status': video_asset.processing_status,
            'created_at': video_asset.created_at.isoformat(),
            'message': 'Video uploaded and stored successfully'
        }, status=status.HTTP_201_CREATED)
        
    except ValueError as e:
        # Handle validation errors from storage service
        logger.warning(f"Video upload validation failed: {e}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Video upload error: {e}")
        return Response({
            'error': 'Upload failed. Please try again.',
            'details': str(e) if settings.DEBUG else None
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_videos(request):
    """
    List uploaded videos (for debugging and management)
    """
    try:
        from core.models import VideoAsset
        from core.services.storage import VideoStorageService
        
        # Get recent videos
        videos = VideoAsset.objects.filter(is_valid=True).order_by('-created_at')[:20]
        
        storage_service = VideoStorageService()
        video_list = []
        
        for video in videos:
            video_data = {
                'id': str(video.id),
                'filename': video.orig_filename,
                'size_mb': round(video.size_bytes / (1024 * 1024), 2),
                'mime_type': video.mime_type,
                'processing_status': video.processing_status,
                'created_at': video.created_at.isoformat(),
                'url': storage_service.get_video_url(video),
                'access_count': video.access_count
            }
            video_list.append(video_data)
        
        return Response({
            'videos': video_list,
            'total_count': len(video_list),
            'message': 'Videos retrieved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error listing videos: {e}")
        return Response({
            'error': 'Failed to retrieve videos'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def delete_video(request, video_id):
    """
    Delete a video asset
    """
    try:
        from core.models import VideoAsset
        from core.services.storage import VideoStorageService
        
        # Get video asset
        try:
            video_asset = VideoAsset.objects.get(id=video_id)
        except VideoAsset.DoesNotExist:
            return Response({
                'error': 'Video not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Delete using existing service
        storage_service = VideoStorageService()
        storage_service.delete_video(video_asset)
        
        return Response({
            'success': True,
            'message': f'Video {video_id} deleted successfully'
        })
        
    except Exception as e:
        logger.error(f"Error deleting video {video_id}: {e}")
        return Response({
            'error': 'Failed to delete video'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _check_upload_rate_limit(client_ip):
    """Check upload rate limiting using existing cache infrastructure"""
    from django.core.cache import cache
    
    key = f"upload_rate_limit:{client_ip}"
    current_count = cache.get(key, 0)
    
    # Use existing rate limit from settings
    max_uploads = getattr(settings, 'UPLOAD_RATE_LIMIT', '10/minute')
    if isinstance(max_uploads, str):
        # Parse "10/minute" format
        try:
            limit, period = max_uploads.split('/')
            limit = int(limit)
            if period == 'minute':
                period_seconds = 60
            elif period == 'hour':
                period_seconds = 3600
            else:
                period_seconds = 60  # Default to 1 minute
        except:
            limit, period_seconds = 10, 60  # Default fallback
    else:
        limit, period_seconds = max_uploads, 60
    
    if current_count >= limit:
        return False
    
    cache.set(key, current_count + 1, period_seconds)
    return True


@api_view(['POST'])
@permission_classes([AllowAny])
def test_endpoint(request):
    """
    Test endpoint for monitoring and debugging
    """
    test_data = {
        'message': 'Test endpoint working',
        'timestamp': time.time(),
        'request_id': getattr(request, 'request_id', 'unknown'),
        'method': request.method,
        'headers': dict(request.headers),
        'data': request.data if hasattr(request, 'data') else None,
        'query_params': dict(request.GET),
        'user': request.user.username if request.user.is_authenticated else 'anonymous'
    }
    
    logger.info(f"Test endpoint called: {test_data}")
    
    return Response(test_data)


def upload_test_page(request):
    """
    Render the video upload test page
    """
    return render(request, 'test_video_upload.html')


@api_view(['GET'])
def debug_settings(request):
    """Debug endpoint to show current video upload settings"""
    from django.conf import settings
    
    debug_info = {
        'ALLOWED_VIDEO_MIME_TYPES': getattr(settings, 'ALLOWED_VIDEO_MIME_TYPES', 'NOT_SET'),
        'ALLOWED_VIDEO_EXTENSIONS': getattr(settings, 'ALLOWED_VIDEO_EXTENSIONS', 'NOT_SET'),
        'MAX_UPLOAD_SIZE': getattr(settings, 'MAX_UPLOAD_SIZE', 'NOT_SET'),
        'DEFAULT_FILE_STORAGE': getattr(settings, 'DEFAULT_FILE_STORAGE', 'NOT_SET'),
        'AWS_STORAGE_BUCKET_NAME': getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'NOT_SET'),
        'DJANGO_SETTINGS_MODULE': os.environ.get('DJANGO_SETTINGS_MODULE', 'NOT_SET'),
    }
    
    return Response(debug_info)
