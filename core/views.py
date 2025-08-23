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

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Comprehensive health check endpoint for the LMS system
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
            f'# HELP lms_cpu_percent CPU usage percentage',
            f'# TYPE lms_cpu_percent gauge',
            f'lms_cpu_percent {cpu_percent}',
            '',
            f'# HELP lms_memory_percent Memory usage percentage',
            f'# TYPE lms_memory_percent gauge',
            f'lms_memory_percent {memory.percent}',
            '',
            f'# HELP lms_memory_bytes Memory usage in bytes',
            f'# TYPE lms_memory_bytes gauge',
            f'lms_memory_bytes {memory.used}',
            '',
            f'# HELP lms_disk_percent Disk usage percentage',
            f'# TYPE lms_disk_percent gauge',
            f'lms_disk_percent {disk.percent}',
            '',
            f'# HELP lms_disk_free_bytes Free disk space in bytes',
            f'# TYPE lms_disk_free_bytes gauge',
            f'lms_disk_free_bytes {disk.free}',
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
            f'# HELP lms_database_tables Total number of database tables',
            f'# TYPE lms_database_tables gauge',
            f'lms_database_tables {table_count}',
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
                f'# HELP lms_storage_free_bytes Free storage space in bytes',
                f'# TYPE lms_storage_free_bytes gauge',
                f'lms_storage_free_bytes {free_space}',
                '',
                f'# HELP lms_storage_total_bytes Total storage space in bytes',
                f'# TYPE lms_storage_total_bytes gauge',
                f'lms_storage_total_bytes {total_space}',
            ])
    except Exception as e:
        logger.error(f"Failed to collect storage metrics: {e}")
    
    # Request metrics
    request_id = getattr(request, 'request_id', 'unknown')
    metrics_data.extend([
        '',
        f'# HELP lms_request_id Current request ID for correlation',
        f'# TYPE lms_request_id gauge',
        f'lms_request_id{{id="{request_id}"}} 1',
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
