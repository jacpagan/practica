# Practika Dependencies Analysis

## Core Dependencies (`requirements.txt`)

### Django Framework
- **Django** - Core web framework
- **djangorestframework** - API framework for exercises/comments
- **django-filter** - Filtering support for API endpoints
- **django-cors-headers** - CORS handling for cross-origin requests

### File Handling
- **Pillow** - Image processing (video posters, thumbnails)
- **python-magic** - File type detection and validation
- **django-storages** - Storage backend abstraction (local/S3)

### Cloud Services
- **boto3** - AWS S3 integration for production storage
- **psycopg2-binary** - PostgreSQL adapter for production database

### Caching & Performance
- **redis** - **OUT-OF-SCOPE** - Redis cache backend
- **django-redis** - **OUT-OF-SCOPE** - Redis integration

### Monitoring & Metrics
- **django-prometheus** - **OUT-OF-SCOPE** - Prometheus metrics
- **django-health-check** - **OUT-OF-SCOPE** - Health check framework
- **psutil** - **OUT-OF-SCOPE** - System monitoring (memory, processes)

### Development & Testing
- **django-debug-toolbar** - **OUT-OF-SCOPE** - Development debugging
- **pytest** - Testing framework
- **pytest-django** - Django test integration
- **model-bakery** - Test data factories

### Deployment
- **gunicorn** - WSGI server for production
- **whitenoise** - Static file serving
- **python-dotenv** - Environment variable loading

### Utility
- **dj-database-url** - Database URL parsing for Heroku

## Development Dependencies (`requirements-dev.txt`)
- **pytest** - Testing framework
- **pytest-django** - Django test integration
- **model-bakery** - Test data factories

## Dependency Analysis by Scope

### IN-SCOPE (Keep)
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

### OUT-OF-SCOPE (Remove)
```
redis                    # Not needed for v1
django-redis             # Redis integration
django-prometheus        # Metrics (not v1)
django-health-check      # Health framework (not v1)
psutil                   # System monitoring (not v1)
django-debug-toolbar     # Development only (not v1)
```

## Dependency Justification

### Core Framework
- **Django**: Required for web application
- **DRF**: Required for exercise/comment APIs
- **django-filter**: Required for API filtering
- **django-cors-headers**: Required for cross-origin requests

### File Handling
- **Pillow**: Required for video poster generation
- **python-magic**: Required for file type validation
- **django-storages**: Required for S3 production storage

### Cloud Services
- **boto3**: Required for S3 integration
- **psycopg2-binary**: Required for PostgreSQL production

### Deployment
- **gunicorn**: Required for production WSGI server
- **whitenoise**: Required for static file serving
- **python-dotenv**: Required for environment configuration
- **dj-database-url**: Required for Heroku database parsing

### Testing
- **pytest**: Required for test suite
- **pytest-django**: Required for Django test integration
- **model-bakery**: Required for test data generation

## Redis Dependency Analysis

### Current Usage
- **Cache backend**: Production cache via Redis
- **Rate limiting**: Security middleware rate limiting
- **Account lockout**: Failed login attempt tracking

### v1 Alternatives
- **Cache**: Use Django's built-in database cache
- **Rate limiting**: Simple in-memory rate limiting
- **Account lockout**: Database-based tracking

### Decision
**REMOVE Redis** - Not strictly required for v1 functionality. All Redis-dependent features can be implemented with simpler alternatives.

## Metrics Dependencies

### Current Usage
- **django-prometheus**: Prometheus metrics endpoint
- **django-health-check**: Health check framework
- **psutil**: System resource monitoring

### v1 Alternatives
- **Health check**: Simple custom health endpoint
- **Metrics**: Remove Prometheus integration
- **Monitoring**: Basic logging only

### Decision
**REMOVE metrics dependencies** - Not required for v1. Health check can be a simple endpoint that returns 200.

## Development Dependencies

### Current Usage
- **django-debug-toolbar**: Development debugging
- **psutil**: System monitoring in middleware

### v1 Alternatives
- **Debug toolbar**: Remove (development only)
- **System monitoring**: Remove from middleware

### Decision
**REMOVE development dependencies** - Not required for v1 production deployment.

## Storage Dependencies

### Current Usage
- **django-storages**: Storage backend abstraction
- **boto3**: S3 integration
- **Pillow**: Image processing

### v1 Requirements
- **Local storage**: Development environment
- **S3 storage**: Production environment
- **Image processing**: Video poster generation

### Decision
**KEEP storage dependencies** - Required for v1 video upload and storage functionality.

## Testing Dependencies

### Current Usage
- **pytest**: Test framework
- **pytest-django**: Django test integration
- **model-bakery**: Test data generation

### v1 Requirements
- **Unit tests**: Core functionality
- **Integration tests**: API endpoints
- **Test data**: Exercise and comment creation

### Decision
**KEEP testing dependencies** - Required for v1 quality assurance.

## Dependency Reduction Impact

### Files to Remove
- Redis configuration in settings
- Prometheus metrics endpoints
- Performance monitoring middleware
- Debug toolbar configuration

### Code to Simplify
- Cache configuration (use database cache)
- Rate limiting (simplify to basic)
- Health check (custom simple endpoint)
- Middleware (remove complex monitoring)

### Net Effect
- **Reduced complexity**: Simpler configuration
- **Faster startup**: No Redis connection attempts
- **Smaller footprint**: Fewer dependencies
- **Easier deployment**: Fewer external services
