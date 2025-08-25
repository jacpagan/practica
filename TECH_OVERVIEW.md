# Practika Technical Overview

## Project Structure
```
practika_project/          # Django project root
├── core/                  # Core functionality (video storage, middleware)
├── exercises/             # Exercise management
├── comments/              # Video comment system
├── practika_project/      # Project settings and configuration
├── static/                # Static assets
├── templates/             # HTML templates
├── media/                 # User-uploaded content
└── tests/                 # Test suite
```

## Settings Modules
- **Main**: `practika_project/settings.py` (448 lines)
- **Environment-specific**: None currently configured
- **Settings loaded**: Via `python-dotenv` from `.env` file

## Installed Apps
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth", 
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",           # API framework
    "django_filters",          # Filtering support
    "corsheaders",            # CORS handling
    "core",                    # Core functionality
    "exercises",               # Exercise management
    "comments",                # Video comments
]
```

## Middleware Order
```python
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",           # CORS
    "django.middleware.security.SecurityMiddleware",   # Security headers
    "whitenoise.middleware.WhiteNoiseMiddleware",      # Static files
    "django.contrib.sessions.middleware.SessionMiddleware", # Sessions
    "django.middleware.common.CommonMiddleware",       # Common
    "django.middleware.csrf.CsrfViewMiddleware",       # CSRF
    "django.contrib.auth.middleware.AuthenticationMiddleware", # Auth
    "django.contrib.messages.middleware.MessageMiddleware", # Messages
    "django.middleware.clickjacking.XFrameOptionsMiddleware", # Clickjacking
    "core.middleware.RequestLoggingMiddleware",        # Custom: Request logging
    "core.middleware.PerformanceMonitoringMiddleware", # Custom: Performance
    "core.middleware.SecurityMiddleware",              # Custom: Security
    "core.middleware.MobileOptimizationMiddleware",    # Custom: Mobile
]
```

## Custom Middleware (core/middleware.py - 910 lines)
1. **RequestLoggingMiddleware** - Comprehensive request logging and monitoring
2. **PerformanceMonitoringMiddleware** - Database performance, memory usage monitoring
3. **SecurityHeadersMiddleware** - Security headers addition
4. **DatabaseConnectionMiddleware** - Database connection monitoring
5. **RateLimitMiddleware** - Basic rate limiting
6. **SecurityMiddleware** - Enhanced security (login rate limiting, account lockout)
7. **MobileOptimizationMiddleware** - Mobile device optimization
8. **DeviceCompatibilityMiddleware** - Browser capability detection

## Database Configuration
- **Engine**: Configurable via `DJANGO_DB_ENGINE` env var
- **Default**: SQLite3 (`db.sqlite3`)
- **Production**: PostgreSQL support via `psycopg2-binary`
- **Connection pooling**: Enabled in production (max 20 connections)

## Cache Configuration
- **Development**: `django.core.cache.backends.locmem.LocMemCache`
- **Production**: Redis via `django.core.cache.backends.redis.RedisCache`
- **Redis URL**: Configurable via `DJANGO_REDIS_URL` env var

## Storage Services
- **Local**: File system storage for development
- **Production**: S3 via `boto3` and `django-storages`
- **Service**: `core.services.storage.VideoStorageService`

## Logging Configuration
- **Handlers**: Console, file rotation, error files, security files
- **Formatters**: Verbose, simple, JSON
- **Log files**: `logs/django.log`, `logs/error.log`, `logs/security.log`
- **Levels**: DEBUG (dev), INFO (prod)

## Performance Monitoring
- **Enabled**: Via `PERFORMANCE_MONITORING.ENABLED`
- **Slow query threshold**: Configurable (default: 1.0s)
- **Memory usage tracking**: Enabled
- **Metrics**: Prometheus support (optional)

## Security Features
- **Rate limiting**: Login (5/minute), Upload (10/minute)
- **Account lockout**: After 5 failed attempts for 5 minutes
- **Security headers**: HSTS, XSS protection, content type options
- **CSRF**: Enabled with session-based tokens
- **Session security**: HTTP-only, secure cookies in production

## Mobile Optimization
- **PWA support**: Progressive Web App features
- **Device detection**: iOS/Android version detection
- **Performance modes**: Conservative, balanced, optimized
- **Touch targets**: Configurable sizes for different devices
- **Video compression**: Optional mobile video optimization
