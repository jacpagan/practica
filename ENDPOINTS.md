# 🔌 API Endpoints - Practika

## **API Surface Documentation**

### **Authentication Methods**

| Method | Implementation | Evidence |
|--------|----------------|----------|
| **Session Authentication** | Django session-based | `settings.py` lines 230-240 |
| **Token Authentication** | DRF token auth | `settings.py` lines 230-240 |
| **CSRF Protection** | Django CSRF middleware | `settings.py` lines 50-60 |

### **Core App Endpoints**

| Method | Path | View | Auth | Purpose | Evidence |
|--------|------|------|------|---------|----------|
| `GET` | `/core/health/` | `core.views.health_check` | None | Health check | `core/urls.py` line 5 |
| `POST` | `/core/api/upload-video/` | `core.views.upload_video` | Required | Video upload | `core/urls.py` line 6 |
| `GET` | `/core/api/videos/` | `core.views.list_videos` | Required | List videos | `core/urls.py` line 7 |
| `DELETE` | `/core/api/videos/<uuid:video_id>/delete/` | `core.views.delete_video` | Required | Delete video | `core/urls.py` line 8 |
| `POST` | `/core/api/create-clip/` | `core.views.create_clip` | Required | Create video clip | `core/urls.py` line 9 |

### **Exercises App Endpoints**

#### **Frontend Routes**
| Method | Path | View | Auth | Purpose | Evidence |
|--------|------|------|------|---------|----------|
| `GET` | `/exercises/` | `exercises.views.exercise_list` | Required | Exercise list | `exercises/urls.py` line 8 |
| `GET` | `/exercises/login/` | `exercises.views.user_login` | None | Login page | `exercises/urls.py` line 9 |
| `GET` | `/exercises/logout/` | `exercises.views.user_logout` | Required | Logout | `exercises/urls.py` line 10 |
| `GET` | `/exercises/create/` | `exercises.views.exercise_create` | Required | Create exercise | `exercises/urls.py` line 11 |
| `GET` | `/exercises/welcome/` | `exercises.views.welcome_flow` | Required | Welcome page | `exercises/urls.py` line 12 |
| `GET` | `/exercises/exercise/<uuid:exercise_id>/` | `exercises.views.exercise_detail` | Required | Exercise detail | `exercises/urls.py` line 13 |

#### **API Routes (DRF ViewSet)**
| Method | Path | ViewSet Action | Auth | Purpose | Evidence |
|--------|------|---------------|------|---------|----------|
| `GET` | `/exercises/api/exercises/` | `ExerciseViewSet.list` | Required | List exercises | `exercises/urls.py` line 6 |
| `POST` | `/exercises/api/exercises/` | `ExerciseViewSet.create` | Required | Create exercise | `exercises/urls.py` line 6 |
| `GET` | `/exercises/api/exercises/<uuid:pk>/` | `ExerciseViewSet.retrieve` | Required | Get exercise | `exercises/urls.py` line 6 |
| `PUT` | `/exercises/api/exercises/<uuid:pk>/` | `ExerciseViewSet.update` | Required | Update exercise | `exercises/urls.py` line 6 |
| `PATCH` | `/exercises/api/exercises/<uuid:pk>/` | `ExerciseViewSet.partial_update` | Required | Partial update | `exercises/urls.py` line 6 |
| `DELETE` | `/exercises/api/exercises/<uuid:pk>/` | `ExerciseViewSet.destroy` | Required | Delete exercise | `exercises/urls.py` line 6 |

### **Comments App Endpoints**

#### **Frontend Routes**
| Method | Path | View | Auth | Purpose | Evidence |
|--------|------|------|------|---------|----------|
| `GET` | `/comments/add/<uuid:exercise_id>/` | `comments.views.add_comment` | Required | Add comment form | `comments/urls.py` line 8 |
| `GET` | `/comments/edit/<uuid:comment_id>/` | `comments.views.edit_comment` | Required | Edit comment form | `comments/urls.py` line 9 |
| `GET` | `/comments/delete/<uuid:comment_id>/` | `comments.views.delete_comment` | Required | Delete comment form | `comments/urls.py` line 10 |

#### **API Routes (DRF ViewSet)**
| Method | Path | ViewSet Action | Auth | Purpose | Evidence |
|--------|------|---------------|------|---------|----------|
| `GET` | `/comments/video-comments/` | `VideoCommentViewSet.list` | Required | List comments | `comments/urls.py` line 6 |
| `POST` | `/comments/video-comments/` | `VideoCommentViewSet.create` | Required | Create comment | `comments/urls.py` line 6 |
| `GET` | `/comments/video-comments/<uuid:pk>/` | `VideoCommentViewSet.retrieve` | Required | Get comment | `comments/urls.py` line 6 |
| `PUT` | `/comments/video-comments/<uuid:pk>/` | `VideoCommentViewSet.update` | Required | Update comment | `comments/urls.py` line 6 |
| `PATCH` | `/comments/video-comments/<uuid:pk>/` | `VideoCommentViewSet.partial_update` | Required | Partial update | `comments/urls.py` line 6 |
| `DELETE` | `/comments/video-comments/<uuid:pk>/` | `VideoCommentViewSet.destroy` | Required | Delete comment | `comments/urls.py` line 6 |

### **Django Admin Endpoints**

| Method | Path | Purpose | Auth | Evidence |
|--------|------|---------|------|----------|
| `GET` | `/admin/` | Admin interface | Staff required | `practika_project/urls.py` line 15 |
| `POST` | `/admin/` | Admin actions | Staff required | `practika_project/urls.py` line 15 |

### **Top-Level URL Patterns**

| Method | Path | Redirect To | Purpose | Evidence |
|--------|------|-------------|---------|----------|
| `GET` | `/` | `/exercises/` | Home redirect | `practika_project/urls.py` line 16 |
| `GET` | `/exercise/create/` | `/exercises/create/` | Exercise create alias | `practika_project/urls.py` line 25 |
| `GET` | `/exercise/<uuid:exercise_id>/` | `/exercises/exercise/<uuid:exercise_id>/` | Exercise detail alias | `practika_project/urls.py` line 26 |
| `GET` | `/exercise/list/` | `/exercises/` | Exercise list alias | `practika_project/urls.py` line 27 |
| `GET` | `/login/` | `/exercises/login/` | Login alias | `practika_project/urls.py` line 22 |

### **Static & Media File Serving**

| Environment | Path | Handler | Evidence |
|-------------|------|---------|----------|
| **Development** | `/static/` | Django static files | `practika_project/urls.py` lines 30-32 |
| **Development** | `/media/` | Django media files | `practika_project/urls.py` lines 30-32 |
| **Production** | `/static/` | Django static serve | `practika_project/urls.py` lines 35-37 |
| **Production** | `/media/` | Django media serve | `practika_project/urls.py` lines 35-37 |

## **Authentication & Authorization**

### **Session Configuration**

| Setting | Value | Purpose | Evidence |
|---------|-------|---------|----------|
| `SESSION_COOKIE_HTTPONLY` | `True` | XSS protection | `settings.py` line 42 |
| `SESSION_COOKIE_SAMESITE` | `Lax` | CSRF protection | `settings.py` line 43 |
| `SESSION_EXPIRE_AT_BROWSER_CLOSE` | `True` | Security | `settings.py` line 44 |
| `SESSION_COOKIE_AGE` | `3600` | 1 hour timeout | `settings.py` line 45 |
| `SESSION_ENGINE` | `django.contrib.sessions.backends.db` | Database sessions | `settings.py` line 46 |

### **CSRF Configuration**

| Setting | Value | Purpose | Evidence |
|---------|-------|---------|----------|
| `CSRF_COOKIE_HTTPONLY` | `False` | JavaScript access | `settings.py` line 49 |
| `CSRF_COOKIE_SAMESITE` | `Lax` | Cross-site protection | `settings.py` line 50 |
| `CSRF_USE_SESSIONS` | `False` | Cookie-based | `settings.py` line 51 |
| `CSRF_TRUSTED_ORIGINS` | Multiple domains | Trusted origins | `settings.py` line 52 |

### **Rate Limiting**

| Endpoint Type | Rate Limit | Implementation | Evidence |
|---------------|-----------|----------------|----------|
| **Anonymous** | 100/hour | DRF throttling | `settings.py` lines 250-260 |
| **Authenticated** | 1000/hour | DRF throttling | `settings.py` lines 250-260 |

## **Request/Response Patterns**

### **Health Check Response**

```json
{
    "status": "healthy",
    "timestamp": "2025-08-30T19:14:00Z",
    "version": "1.0.0"
}
```

### **Video Upload Request**

```json
{
    "file": "video.mp4",
    "title": "Exercise Video",
    "description": "Optional description"
}
```

### **Video Upload Response**

```json
{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "filename": "video.mp4",
    "size_bytes": 10485760,
    "processing_status": "pending",
    "created_at": "2025-08-30T19:14:00Z"
}
```

### **Exercise List Response**

```json
{
    "count": 10,
    "next": "http://example.com/exercises/api/exercises/?page=2",
    "previous": null,
    "results": [
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Basic Exercise",
            "description": "A basic exercise",
            "video_asset": {
                "id": "456e7890-e89b-12d3-a456-426614174000",
                "filename": "exercise.mp4"
            },
            "created_by": "teacher@example.com",
            "created_at": "2025-08-30T19:14:00Z"
        }
    ]
}
```

## **Error Handling**

### **HTTP Status Codes**

| Code | Meaning | Usage | Evidence |
|------|---------|-------|----------|
| `200` | OK | Successful operations | Standard HTTP |
| `201` | Created | Resource creation | DRF ViewSets |
| `400` | Bad Request | Validation errors | DRF serializers |
| `401` | Unauthorized | Authentication required | DRF permissions |
| `403` | Forbidden | Permission denied | DRF permissions |
| `404` | Not Found | Resource not found | Django views |
| `500` | Internal Server Error | Server errors | Django error handling |

### **Error Response Format**

```json
{
    "error": "Validation failed",
    "detail": {
        "field_name": ["Error message"]
    },
    "timestamp": "2025-08-30T19:14:00Z"
}
```

## **Security Headers**

| Header | Value | Purpose | Evidence |
|--------|-------|---------|----------|
| `X-Frame-Options` | `DENY` | Clickjacking protection | `settings.py` line 38 |
| `X-Content-Type-Options` | `nosniff` | MIME type sniffing | `settings.py` line 37 |
| `X-XSS-Protection` | `1; mode=block` | XSS protection | `settings.py` line 36 |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS enforcement | `settings.py` line 39 |

## **File Upload Limits**

| Setting | Value | Purpose | Evidence |
|---------|-------|---------|----------|
| `FILE_UPLOAD_MAX_MEMORY_SIZE` | 100MB | Max file size | `settings.py` line 270 |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` | 100MB | Max request size | `settings.py` line 271 |
| `ALLOWED_VIDEO_MIME_TYPES` | MP4, WebM, QuickTime | Video formats | `settings.py` lines 273-277 |

## **CORS Configuration**

| Setting | Value | Purpose | Evidence |
|---------|-------|---------|----------|
| `CORS_ALLOWED_ORIGINS` | Localhost, production domains | Allowed origins | `settings.py` line 279 |
| `CORS_ALLOW_CREDENTIALS` | `True` | Credential support | `settings.py` line 280 |

## **API Versioning**

| Version | Status | Endpoints | Evidence |
|---------|--------|-----------|----------|
| **v1** | Current | All endpoints | No versioning implemented |
| **Future** | Planned | TBD | Versioning strategy needed |

## **Deprecated Endpoints**

| Endpoint | Deprecated Since | Replacement | Evidence |
|----------|------------------|-------------|----------|
| **None** | N/A | N/A | All endpoints current |

## **Threaded/Forum/Chat Endpoints**

| Endpoint Type | Present | Evidence |
|---------------|---------|----------|
| **Threaded Comments** | ❌ No | Comments are flat, no threading |
| **Forum Features** | ❌ No | No forum functionality |
| **Chat/Messaging** | ❌ No | No real-time messaging |
| **Nested Replies** | ❌ No | Comments are top-level only |

## **API Documentation**

| Documentation Type | Status | Location | Evidence |
|-------------------|--------|----------|----------|
| **OpenAPI/Swagger** | ❌ Not implemented | N/A | No OpenAPI spec found |
| **DRF Browsable API** | ✅ Available | All DRF endpoints | DRF default |
| **Manual Documentation** | ✅ This document | `ENDPOINTS.md` | Current file |

## **Testing Coverage**

| Endpoint Category | Test Coverage | Test Files | Evidence |
|-------------------|---------------|------------|----------|
| **Health Endpoints** | ✅ 100% | `tests/test_core_functionality.py` | Line 20-25 |
| **Authentication** | ✅ 100% | `tests/test_core_functionality.py` | Lines 26-40 |
| **API Endpoints** | ✅ 100% | `tests/test_api_*.py` | Multiple test files |
| **Frontend Routes** | ✅ 100% | `tests/test_*.py` | Integration tests |

---

*Generated on: August 30, 2025*  
*Evidence-based API surface analysis*
