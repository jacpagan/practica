# Practika Domain Refactor Plan

## Mission
Reduce to three core models: Exercise, VideoAsset, VideoComment (peers only). One storage abstraction; no alternate code paths. No network or DB calls at import time; no heavy work in app startup.

## Current Module Structure (Before)

### Core App (`core/`)
```
core/
├── __init__.py
├── admin.py
├── apps.py
├── exceptions.py
├── middleware.py              # 910 lines - COMPLEX
├── migrations/
├── models.py                  # 310 lines - VideoAsset with heavy operations
├── security.py               # Security utilities
├── services/
│   ├── cloud_storage.py      # S3 storage service
│   └── storage.py            # Storage abstraction
├── templates/
├── tests.py
├── urls.py                   # 8 routes (some out-of-scope)
└── views.py                  # Complex views with monitoring
```

### Exercises App (`exercises/`)
```
exercises/
├── __init__.py
├── admin.py
├── apps.py
├── html_urls.py              # HTML routes
├── html_views.py             # HTML views
├── migrations/
├── models.py                  # 22 lines - Simple Exercise model
├── permissions.py             # Permission classes
├── serializers.py             # DRF serializers
├── templates/                 # HTML templates
├── tests.py
├── urls.py                   # 10 routes (HTML + API)
└── views.py                  # DRF ViewSet + HTML views
```

### Comments App (`comments/`)
```
comments/
├── __init__.py
├── admin.py
├── apps.py
├── migrations/
├── models.py                  # 23 lines - Simple VideoComment model
├── permissions.py             # Permission classes
├── serializers.py             # DRF serializers
├── templates/
├── tests.py
├── urls.py                   # 5 routes (API only)
└── views.py                  # DRF ViewSet
```

### Project Settings (`practika_project/`)
```
practika_project/
├── __init__.py
├── asgi.py
├── production.py             # Production settings
├── settings_heroku.py        # Heroku settings
├── settings_heroku_fixed.py  # Fixed Heroku settings
├── settings_heroku_standalone.py  # Standalone Heroku settings
├── settings.py               # 448 lines - COMPLEX
├── test_settings.py          # Test settings
├── urls.py                   # 17 lines - Root routing
├── wsgi.py
└── wsgi.py
```

## Target Module Structure (After)

### Core App (`core/`) - SIMPLIFIED
```
core/
├── __init__.py
├── admin.py
├── apps.py
├── migrations/
├── models.py                  # 100 lines - Clean VideoAsset
├── services/
│   └── storage.py            # Single storage abstraction
├── tests.py
├── urls.py                   # 4 routes (core only)
└── views.py                  # Simple views
```

### Exercises App (`exercises/`) - UNCHANGED
```
exercises/
├── __init__.py
├── admin.py
├── apps.py
├── migrations/
├── models.py                  # 22 lines - Exercise model
├── permissions.py             # Permission classes
├── serializers.py             # DRF serializers
├── templates/                 # HTML templates
├── tests.py
├── urls.py                   # 10 routes (HTML + API)
└── views.py                  # DRF ViewSet + HTML views
```

### Comments App (`comments/`) - UNCHANGED
```
comments/
├── __init__.py
├── admin.py
├── apps.py
├── migrations/
├── models.py                  # 23 lines - VideoComment model
├── permissions.py             # Permission classes
├── serializers.py             # DRF serializers
├── templates/
├── tests.py
├── urls.py                   # 5 routes (API only)
└── views.py                  # DRF ViewSet
```

### Project Settings (`practika_project/`) - SIMPLIFIED
```
practika_project/
├── __init__.py
├── asgi.py
├── settings.py               # 200 lines - CLEAN
├── urls.py                   # 17 lines - Root routing
└── wsgi.py
```

## Key Changes

### 1. Core App Simplification

#### Remove Files
- `core/middleware.py` (910 lines → 0 lines)
- `core/exceptions.py` (custom exception handling)
- `core/security.py` (security utilities)
- `core/services/cloud_storage.py` (separate S3 service)
- `core/templates/` (unused templates)

#### Simplify Files
- `core/models.py` (310 lines → 100 lines)
  - Remove heavy validation methods
  - Remove file system operations
  - Remove import-time dependencies
  - Keep core fields and basic methods

- `core/urls.py` (8 routes → 4 routes)
  - Keep: health, upload-video, videos, delete-video
  - Remove: metrics, logs, test, upload-test, debug-settings

- `core/views.py` (complex → simple)
  - Remove monitoring and metrics
  - Keep core upload and video management
  - Simplify health check

#### Consolidate Services
- `core/services/storage.py` (single interface)
  - Local storage backend
  - S3 storage backend
  - Environment-based switching
  - No import-time side effects

### 2. Middleware Elimination

#### Remove All Custom Middleware
- `RequestLoggingMiddleware` (comprehensive logging)
- `PerformanceMonitoringMiddleware` (system monitoring)
- `SecurityHeadersMiddleware` (duplicate functionality)
- `DatabaseConnectionMiddleware` (connection monitoring)
- `RateLimitMiddleware` (rate limiting)
- `SecurityMiddleware` (advanced security)
- `MobileOptimizationMiddleware` (mobile optimization)
- `DeviceCompatibilityMiddleware` (browser detection)

#### Keep Django Built-in Middleware
```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
```

### 3. Settings Simplification

#### Remove Complex Configuration
- Redis cache configuration
- Performance monitoring settings
- Prometheus metrics settings
- Mobile optimization settings
- Complex rate limiting settings
- Advanced security features

#### Simplify Configuration
- Basic Django settings
- Database configuration
- Static/media configuration
- REST framework configuration
- Basic security headers
- Simple logging configuration
- Storage configuration

### 4. Model Simplification

#### VideoAsset Model (310 → 100 lines)
**Keep Fields**
- Core: id, orig_filename, storage_path, mime_type, size_bytes
- Metadata: duration_sec, width, height
- Timestamps: created_at, updated_at
- Status: processing_status, processing_error

**Remove Fields**
- Access tracking: access_count, last_accessed
- Validation: is_valid, validation_errors, last_validated
- Poster: poster_path
- Processing: processed_at

**Simplify Methods**
- Keep: clean(), save(), __str__()
- Remove: _calculate_checksum(), validate_integrity(), mark_accessed()
- Remove: get_public_url(), get_file_info(), get_storage_stats()

**Remove Import-Time Dependencies**
- No storage service imports
- No file system operations
- No heavy validation logic

#### Exercise Model (22 lines - UNCHANGED)
- Keep all fields and methods
- No changes needed

#### VideoComment Model (23 lines - UNCHANGED)
- Keep all fields and methods
- No changes needed

### 5. Storage Service Consolidation

#### Single Storage Interface
```python
# core/services/storage.py
class VideoStorageService:
    def __init__(self):
        self.backend = self._get_backend()
    
    def _get_backend(self):
        if settings.USE_S3:
            return S3StorageBackend()
        return LocalStorageBackend()
    
    def upload_video(self, file_obj, filename):
        return self.backend.upload(file_obj, filename)
    
    def get_video_url(self, video_asset):
        return self.backend.get_url(video_asset.storage_path)
    
    def delete_video(self, storage_path):
        return self.backend.delete(storage_path)
```

#### Backend Implementations
- `LocalStorageBackend`: File system storage
- `S3StorageBackend`: S3 storage via boto3
- Environment-based switching via settings

### 6. URL Simplification

#### Core Routes (8 → 4)
```
/core/health/               # Simple health check
/core/api/upload-video/     # Video upload
/core/api/videos/           # List videos
/core/api/videos/<uuid>/delete/  # Delete video
```

#### Remove Out-of-Scope Routes
```
/core/metrics/              # Prometheus metrics
/core/logs/                 # Log viewing
/core/test/                 # Test endpoint
/core/upload-test/          # Upload testing
/core/debug-settings/       # Debug configuration
```

## Import-Time Side Effects Elimination

### Current Issues
1. **VideoAsset model**: Imports storage service at import time
2. **Middleware**: Heavy initialization and monitoring setup
3. **Settings**: Complex configuration loading
4. **Services**: Database connections during import

### Solutions
1. **Lazy loading**: Import services only when needed
2. **Simple models**: No heavy operations in model methods
3. **Minimal middleware**: Only Django built-in middleware
4. **Simple settings**: No complex configuration loading

## Storage Abstraction

### Single Code Path
- **Development**: Local file system storage
- **Production**: S3 storage via boto3
- **Interface**: Same API for both backends
- **Switching**: Environment variable based

### No Alternate Paths
- Single upload method
- Single URL generation method
- Single deletion method
- Consistent error handling

## App Startup Simplification

### Remove Heavy Operations
- No Redis connection attempts
- No performance monitoring setup
- No complex middleware initialization
- No metrics collection setup

### Keep Essential Operations
- Database connection (if needed)
- Static file collection
- Basic logging setup
- Storage service initialization

## Expected Outcomes

### File Count Reduction
- **Before**: 3 apps + complex middleware + multiple services
- **After**: 3 apps + simple services + no middleware
- **Target**: 20% reduction in total files

### Line Count Reduction
- **Core models**: 310 → 100 lines (68% reduction)
- **Core views**: Complex → Simple (estimated 70% reduction)
- **Settings**: 448 → 200 lines (55% reduction)
- **Middleware**: 910 → 0 lines (100% reduction)

### Complexity Reduction
- **Middleware**: 8 custom classes → 0
- **Services**: 2 storage services → 1 interface
- **Configuration**: Complex → Simple
- **Dependencies**: 23 → 17 packages

### Performance Improvement
- **Startup time**: Faster (no heavy middleware)
- **Memory usage**: Lower (no monitoring overhead)
- **Import time**: Faster (no side effects)
- **Runtime**: Cleaner (no unused features)

## Implementation Order

### Phase 1: Remove Out-of-Scope Features
1. Remove metrics endpoints
2. Remove complex middleware
3. Remove unused routes
4. Remove unused dependencies

### Phase 2: Simplify Core Models
1. Clean VideoAsset model
2. Remove heavy methods
3. Eliminate import-time dependencies
4. Simplify validation

### Phase 3: Consolidate Services
1. Single storage interface
2. Environment-based backends
3. Remove duplicate code
4. Simplify error handling

### Phase 4: Clean Settings
1. Remove Redis configuration
2. Remove monitoring settings
3. Remove mobile optimization
4. Simplify middleware list

### Phase 5: Testing & Validation
1. Run test suite
2. Verify functionality
3. Check performance
4. Validate deployment
