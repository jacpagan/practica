# Practika Scope Difference Analysis

## Mission Statement
Practika is a **video-first exercise platform** where **every exercise is a video** and **every comment is a video reply**. All users are peers ("students").

## Scope Classification Legend
- **KEEP**: Essential for v1 functionality
- **HIDE**: Behind feature flag, default-off
- **REMOVE**: Out-of-scope for v1

## Routes Analysis

### Root URLs (`practika_project/urls.py`)
```
/                           # KEEP - Simple home page
/core/                      # KEEP - Core functionality
/exercises/                 # KEEP - Exercise management
/comments/                  # KEEP - Video comments
```

### Core App Routes (`core/urls.py`)
```
/core/health/               # KEEP - Health check (simplified)
/core/metrics/              # REMOVE - Prometheus metrics
/core/logs/                 # REMOVE - Log viewing
/core/test/                 # REMOVE - Test endpoint
/core/api/upload-video/     # KEEP - Video upload API
/core/api/videos/           # KEEP - List videos API
/core/api/videos/<uuid>/delete/  # KEEP - Delete video API
/core/upload-test/          # REMOVE - Upload testing
/core/debug-settings/       # REMOVE - Debug configuration
```

### Exercises App Routes (`exercises/urls.py`)
```
/exercises/                 # KEEP - Exercise list (home/feed)
/exercises/login/           # KEEP - User authentication
/exercises/logout/          # KEEP - User logout
/exercises/create/          # KEEP - Create exercise
/exercises/exercise/<uuid>/ # KEEP - Exercise detail
/exercises/api/exercises/   # KEEP - Exercise API
```

### Comments App Routes (`comments/urls.py`)
```
/comments/api/video-comments/  # KEEP - Video comment API
```

## Models Analysis

### Core Models
- **VideoAsset** (`core/models.py`) - **KEEP** - Central video storage
- **User** (Django built-in) - **KEEP** - Authentication

### Exercise Models
- **Exercise** (`exercises/models.py`) - **KEEP** - Exercise definition

### Comment Models
- **VideoComment** (`comments/models.py`) - **KEEP** - Video comments

## Middleware Analysis

### Django Built-in Middleware
- **SecurityMiddleware** - **KEEP** - Security headers
- **SessionMiddleware** - **KEEP** - User sessions
- **CommonMiddleware** - **KEEP** - Common functionality
- **CsrfViewMiddleware** - **KEEP** - CSRF protection
- **AuthenticationMiddleware** - **KEEP** - User authentication
- **MessageMiddleware** - **KEEP** - User messages
- **XFrameOptionsMiddleware** - **KEEP** - Clickjacking protection
- **WhiteNoiseMiddleware** - **KEEP** - Static files
- **CorsMiddleware** - **KEEP** - CORS handling

### Custom Middleware (`core/middleware.py`)
- **RequestLoggingMiddleware** - **HIDE** - Behind flag, default-off
- **PerformanceMonitoringMiddleware** - **REMOVE** - Out-of-scope
- **SecurityHeadersMiddleware** - **REMOVE** - Duplicate of Django's
- **DatabaseConnectionMiddleware** - **REMOVE** - Out-of-scope
- **RateLimitMiddleware** - **HIDE** - Behind flag, default-off
- **SecurityMiddleware** - **HIDE** - Behind flag, default-off
- **MobileOptimizationMiddleware** - **REMOVE** - Out-of-scope
- **DeviceCompatibilityMiddleware** - **REMOVE** - Out-of-scope

## Apps Analysis

### Django Built-in Apps
- **admin** - **KEEP** - Minimal admin interface
- **auth** - **KEEP** - User authentication
- **contenttypes** - **KEEP** - Required by Django
- **sessions** - **KEEP** - User sessions
- **messages** - **KEEP** - User messages
- **staticfiles** - **KEEP** - Static file serving

### Third-party Apps
- **rest_framework** - **KEEP** - API framework
- **django_filters** - **KEEP** - API filtering
- **corsheaders** - **KEEP** - CORS handling

### Custom Apps
- **core** - **KEEP** - Core functionality (simplified)
- **exercises** - **KEEP** - Exercise management
- **comments** - **KEEP** - Video comments

## Dependencies Analysis

### KEEP Dependencies
```
Django                    # Core framework
djangorestframework      # API endpoints
django-filter            # API filtering
django-cors-headers      # CORS support
Pillow                   # Image processing
python-magic             # File validation
django-storages          # Storage abstraction
boto3                    # S3 production storage
psycopg2-binary          # Production database
gunicorn                 # Production server
whitenoise               # Static file serving
python-dotenv            # Environment config
dj-database-url          # Database URL parsing
pytest                   # Testing
pytest-django            # Django testing
model-bakery             # Test data
```

### REMOVE Dependencies
```
redis                    # Not needed for v1
django-redis             # Redis integration
django-prometheus        # Metrics (not v1)
django-health-check      # Health framework (not v1)
psutil                   # System monitoring (not v1)
django-debug-toolbar     # Development only (not v1)
```

## Settings Analysis

### KEEP Settings
- Basic Django configuration
- Database configuration
- Static/media file configuration
- REST framework configuration
- Basic security headers
- Logging configuration (simplified)
- Storage configuration

### REMOVE Settings
- Redis cache configuration
- Performance monitoring configuration
- Prometheus metrics configuration
- Complex rate limiting configuration
- Mobile optimization configuration
- Advanced security features

## Deletion Plan

### Files to Remove
1. **Prometheus metrics**: `/core/metrics/` endpoint
2. **Log viewing**: `/core/logs/` endpoint
3. **Test endpoints**: `/core/test/`, `/core/upload-test/`
4. **Debug settings**: `/core/debug-settings/` endpoint

### Middleware to Remove
1. **PerformanceMonitoringMiddleware** - System monitoring
2. **SecurityHeadersMiddleware** - Duplicate functionality
3. **DatabaseConnectionMiddleware** - Connection monitoring
4. **MobileOptimizationMiddleware** - Mobile optimization
5. **DeviceCompatibilityMiddleware** - Browser detection

### Middleware to Hide (Behind Flags)
1. **RequestLoggingMiddleware** - Comprehensive logging
2. **RateLimitMiddleware** - Rate limiting
3. **SecurityMiddleware** - Advanced security

### Dependencies to Remove
1. **redis** and **django-redis**
2. **django-prometheus**
3. **django-health-check**
4. **psutil**
5. **django-debug-toolbar**

## Ripple Effects

### Settings Changes
- Remove Redis cache configuration
- Simplify middleware list
- Remove performance monitoring
- Remove mobile optimization
- Simplify logging configuration

### Code Changes
- Simplify VideoAsset model (remove heavy operations)
- Remove complex middleware classes
- Simplify health check endpoint
- Remove metrics endpoints
- Simplify rate limiting

### Configuration Changes
- Use database cache instead of Redis
- Simplify security configuration
- Remove monitoring configuration
- Simplify mobile configuration

## Risk Assessment

### Low Risk
- Removing out-of-scope endpoints
- Removing unused middleware
- Removing unused dependencies

### Medium Risk
- Simplifying rate limiting
- Simplifying logging
- Removing performance monitoring

### Mitigation
- Feature flags for complex functionality
- Gradual removal with testing
- Fallback to simpler implementations
- Comprehensive testing after changes

## Success Metrics
- **File count reduction**: Target 20% reduction
- **Dependency reduction**: Target 25% reduction
- **Middleware simplification**: Target 50% reduction
- **Startup time**: Target 30% improvement
- **Memory usage**: Target 20% reduction
