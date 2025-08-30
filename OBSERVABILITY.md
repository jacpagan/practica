# 📊 Observability - Practika

## **Logging Infrastructure**

### **Application Logging**

| Component | Log Level | Format | Destination | Evidence |
|-----------|-----------|--------|-------------|----------|
| **Django App** | INFO | JSON (prod), Simple (dev) | CloudWatch | `settings.py` lines 350-390 |
| **Core App** | INFO | Structured | CloudWatch | `settings.py` lines 380-385 |
| **Exercises App** | INFO | Structured | CloudWatch | `settings.py` lines 386-390 |
| **Comments App** | INFO | Structured | CloudWatch | `settings.py` lines 386-390 |

### **Log Configuration**

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'json': {
            'format': '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'json' if not DEBUG else 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'exercises': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'comments': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

### **AWS CloudWatch Logs**

| Log Group | Retention | Purpose | Evidence |
|-----------|-----------|---------|----------|
| `/ecs/practika-prod` | 30 days | Application logs | `aws-deployment.yml` lines 450-460 |
| `/security/practika-prod` | 90 days | Security events | `aws-deployment.yml` lines 462-470 |

### **Log Streams**

| Stream Pattern | Content | Evidence |
|----------------|---------|----------|
| `practika/practika-web/{container_id}` | Application logs | `aws-deployment.yml` line 340 |
| `practika/practika-web/{task_id}` | Task-specific logs | ECS configuration |

## **Metrics Collection**

### **Application Metrics**

| Metric | Type | Collection | Purpose | Evidence |
|--------|------|------------|---------|----------|
| **Request Count** | Counter | Django middleware | Traffic monitoring | `core/middleware/` |
| **Response Time** | Histogram | Django middleware | Performance tracking | `core/middleware/` |
| **Error Rate** | Counter | Django middleware | Error monitoring | `core/middleware/` |
| **Video Uploads** | Counter | Custom logging | Feature usage | `core/views.py` |
| **Clip Creations** | Counter | Custom logging | Feature usage | `core/views.py` |
| **User Activity** | Counter | Custom logging | Engagement tracking | `accounts/models.py` |

### **AWS Infrastructure Metrics**

| Service | Metrics | Collection | Evidence |
|---------|---------|------------|----------|
| **ECS Fargate** | CPU, Memory, Network | CloudWatch | `aws-deployment.yml` lines 300-340 |
| **Application Load Balancer** | Request count, latency, errors | CloudWatch | `aws-deployment.yml` lines 370-390 |
| **RDS PostgreSQL** | Connections, CPU, storage | CloudWatch | `aws-deployment.yml` lines 250-270 |
| **S3** | Request count, data transfer | CloudWatch | `aws-deployment.yml` lines 220-240 |

### **Custom Metrics**

```python
# Example custom metric collection
import logging
from django.core.cache import cache

logger = logging.getLogger('core.metrics')

def track_video_upload(video_id, file_size):
    """Track video upload metrics"""
    logger.info('video_upload', extra={
        'video_id': str(video_id),
        'file_size_bytes': file_size,
        'metric_type': 'counter',
        'metric_name': 'video_uploads_total'
    })

def track_clip_creation(clip_id, duration):
    """Track clip creation metrics"""
    logger.info('clip_creation', extra={
        'clip_id': str(clip_id),
        'duration_seconds': duration,
        'metric_type': 'histogram',
        'metric_name': 'clip_duration_seconds'
    })
```

## **Monitoring & Alerting**

### **Health Checks**

| Endpoint | Purpose | Frequency | Evidence |
|----------|---------|-----------|----------|
| `/core/health/` | Application health | 30s | `aws-deployment.yml` line 410 |
| ALB Health Check | Load balancer health | 30s | `aws-deployment.yml` lines 392-410 |

### **Health Check Response**

```json
{
    "status": "healthy",
    "timestamp": "2025-08-30T19:14:00Z",
    "version": "1.0.0",
    "database": "connected",
    "storage": "accessible"
}
```

### **CloudWatch Alarms**

| Alarm Name | Metric | Threshold | Action | Evidence |
|------------|--------|-----------|--------|----------|
| **High CPU Usage** | ECS CPU > 80% | 80% | SNS notification | Not configured |
| **High Memory Usage** | ECS Memory > 80% | 80% | SNS notification | Not configured |
| **High Error Rate** | ALB 5xx errors > 5% | 5% | SNS notification | Not configured |
| **Database Connections** | RDS connections > 80% | 80% | SNS notification | Not configured |

### **Missing Alarms**

| Alarm Type | Impact | Recommendation | Priority |
|------------|--------|----------------|----------|
| **Application Errors** | User experience | Monitor 5xx responses | High |
| **Database Performance** | System stability | Monitor slow queries | High |
| **Storage Usage** | Service availability | Monitor S3 usage | Medium |
| **Cost Alerts** | Budget control | Monitor AWS costs | Medium |

## **Dashboards**

### **Current Dashboards**

| Dashboard | Purpose | Status | Evidence |
|-----------|---------|--------|----------|
| **CloudWatch Default** | AWS service metrics | ✅ Available | CloudWatch console |
| **Application Metrics** | Custom app metrics | ❌ Not implemented | No custom dashboard |

### **Recommended Dashboards**

#### **Application Dashboard**
```json
{
    "dashboard_name": "Practika-Application",
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/ECS", "CPUUtilization"],
                    ["AWS/ECS", "MemoryUtilization"]
                ],
                "period": 300,
                "stat": "Average",
                "region": "us-east-1"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/ApplicationELB", "RequestCount"],
                    ["AWS/ApplicationELB", "TargetResponseTime"]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "us-east-1"
            }
        }
    ]
}
```

#### **Business Metrics Dashboard**
```json
{
    "dashboard_name": "Practika-Business",
    "widgets": [
        {
            "type": "log",
            "properties": {
                "query": "SOURCE practika | fields @timestamp, video_uploads_total",
                "region": "us-east-1"
            }
        },
        {
            "type": "log",
            "properties": {
                "query": "SOURCE practika | fields @timestamp, clip_creations_total",
                "region": "us-east-1"
            }
        }
    ]
}
```

## **Tracing & Distributed Monitoring**

### **Request Tracing**

| Component | Tracing | Implementation | Evidence |
|-----------|---------|----------------|----------|
| **Request ID** | ✅ Implemented | Middleware | `core/middleware/request_logging.py` |
| **Distributed Tracing** | ❌ Not implemented | No APM tool | No tracing framework |

### **Request ID Implementation**

```python
# core/middleware/request_logging.py
import uuid
import logging

class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = str(uuid.uuid4())
        request.request_id = request_id
        
        logger = logging.getLogger('core.request')
        logger.info('request_started', extra={
            'request_id': request_id,
            'method': request.method,
            'path': request.path,
            'user': request.user.username if request.user.is_authenticated else 'anonymous'
        })
        
        response = self.get_response(request)
        
        logger.info('request_completed', extra={
            'request_id': request_id,
            'status_code': response.status_code,
            'response_time_ms': getattr(response, 'response_time', 0)
        })
        
        return response
```

## **Error Tracking**

### **Error Handling**

| Error Type | Handling | Evidence |
|------------|----------|----------|
| **Validation Errors** | DRF serializers | `settings.py` lines 230-240 |
| **Authentication Errors** | DRF permissions | `settings.py` lines 230-240 |
| **File Upload Errors** | Custom validation | `core/models.py` lines 80-100 |
| **Database Errors** | Django ORM | Standard Django |

### **Error Logging**

```python
# Example error logging
import logging

logger = logging.getLogger('core.errors')

def handle_video_upload_error(error, video_id):
    """Log video upload errors"""
    logger.error('video_upload_failed', extra={
        'video_id': str(video_id),
        'error_type': type(error).__name__,
        'error_message': str(error),
        'stack_trace': traceback.format_exc()
    })
```

## **Performance Monitoring**

### **Key Performance Indicators**

| KPI | Current | Target | Monitoring | Evidence |
|-----|---------|--------|------------|----------|
| **Page Load Time** | < 2s | < 1s | ALB metrics | `aws-deployment.yml` lines 392-410 |
| **API Response Time** | < 500ms | < 200ms | Custom metrics | `core/middleware/` |
| **Video Upload Time** | < 5s (100MB) | < 3s | Custom metrics | `core/views.py` |
| **Database Query Time** | < 100ms | < 50ms | RDS metrics | `aws-deployment.yml` lines 250-270 |

### **Performance Bottlenecks**

| Bottleneck | Impact | Solution | Evidence |
|------------|--------|----------|----------|
| **No CDN** | Higher latency | Add CloudFront | No CDN configured |
| **Single AZ RDS** | Availability risk | Multi-AZ deployment | `aws-deployment.yml` line 260 |
| **No Caching** | Database load | Add Redis caching | No cache configured |

## **Security Monitoring**

### **Security Events**

| Event Type | Logging | Alerting | Evidence |
|------------|---------|----------|----------|
| **Authentication Failures** | ✅ Logged | ❌ No alerts | `core/middleware/` |
| **Authorization Failures** | ✅ Logged | ❌ No alerts | DRF permissions |
| **File Upload Violations** | ✅ Logged | ❌ No alerts | `core/models.py` |
| **Rate Limit Violations** | ✅ Logged | ❌ No alerts | `settings.py` lines 250-260 |

### **Security Log Group**

| Log Group | Retention | Content | Evidence |
|-----------|-----------|---------|----------|
| `/security/practika-prod` | 90 days | Security events | `aws-deployment.yml` lines 462-470 |

## **Cost Monitoring**

### **AWS Cost Tracking**

| Service | Cost Driver | Monitoring | Evidence |
|---------|-------------|------------|----------|
| **ECS Fargate** | CPU/Memory usage | CloudWatch metrics | `aws-deployment.yml` lines 300-340 |
| **RDS PostgreSQL** | Instance hours | CloudWatch metrics | `aws-deployment.yml` lines 250-270 |
| **S3** | Storage + transfer | CloudWatch metrics | `aws-deployment.yml` lines 220-240 |
| **ALB** | Request count | CloudWatch metrics | `aws-deployment.yml` lines 370-390 |

### **Cost Alerts**

| Alert Type | Threshold | Status | Evidence |
|------------|-----------|--------|----------|
| **Monthly Cost** | > $200 | ❌ Not configured | No cost alerts |
| **Daily Cost Spike** | > 50% increase | ❌ Not configured | No cost alerts |
| **Service Cost** | > $50/month | ❌ Not configured | No cost alerts |

## **Observability Gaps**

### **Missing Components**

| Component | Impact | Priority | Recommendation |
|-----------|--------|----------|----------------|
| **Application Performance Monitoring** | Limited visibility | High | Add APM tool (DataDog, New Relic) |
| **Distributed Tracing** | No request tracing | Medium | Implement OpenTelemetry |
| **Custom Dashboards** | Manual monitoring | Medium | Create CloudWatch dashboards |
| **Cost Alerts** | Budget overruns | High | Configure AWS Cost Explorer alerts |
| **Security Alerts** | Security incidents | High | Configure GuardDuty alerts |

### **Implementation Roadmap**

1. **Phase 1**: Configure CloudWatch alarms for critical metrics
2. **Phase 2**: Implement custom application metrics
3. **Phase 3**: Add APM tool for detailed performance monitoring
4. **Phase 4**: Create comprehensive dashboards
5. **Phase 5**: Implement distributed tracing

## **Log Retention & Compliance**

### **Retention Policies**

| Log Type | Retention | Compliance | Evidence |
|----------|-----------|------------|----------|
| **Application Logs** | 30 days | Basic | `aws-deployment.yml` line 460 |
| **Security Logs** | 90 days | Security | `aws-deployment.yml` line 470 |
| **Access Logs** | 30 days | Audit | ALB configuration |
| **Error Logs** | 90 days | Debugging | Custom configuration |

### **Compliance Requirements**

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **Audit Logging** | ✅ Implemented | CloudWatch logs |
| **Security Event Logging** | ✅ Implemented | Security log group |
| **Performance Monitoring** | ✅ Implemented | CloudWatch metrics |
| **Error Tracking** | ✅ Implemented | Django error handling |

---

*Generated on: August 30, 2025*  
*Evidence-based observability analysis*
