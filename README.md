# Practika

**Video-based learning platform for interactive exercises and video comments.**

## What Practika Is

Practika is a Django-based Learning Management System focused on video-based exercises and comments. This platform allows administrators to create exercises with video content and authenticated users to view exercises and create video comments. Built for mobile-first learning with session authentication, staff CRUD operations for exercises, and video reply capabilities.

## Scope Contract (v1)

### In-Scope
- Three core models: Exercise, VideoAsset, VideoComment
- Five UI surfaces: Home/Feed, Exercise Detail, Upload/Record, Login, Minimal Admin
- Session authentication with staff-only exercise CRUD
- Video replies only (no nested comments)
- 100MB file cap with MP4/WebM/QuickTime/AVI support
- Local development + S3 production storage
- Basic validation, rate limits, security headers
- Health endpoints (liveness only)

### Out-of-Scope
- User registration (admin-created accounts only)
- Nested comment threading
- Video processing/compression
- Advanced analytics
- Mobile apps (web-only)
- Real-time features

### Rules
- No new features without scope approval
- Maintain backward compatibility
- Security-first approach
- Mobile-responsive design required

## Quick Start

### Local Development

```bash
# Create and activate virtual environment
python3 -m venv .practika-venv
source .practika-venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install system dependencies (macOS)
brew install libmagic

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start server
python manage.py runserver
```

### Docker Development

```bash
# Start development environment
make dev-up

# View logs
make logs

# Run tests
make test

# Stop services
make down
```

### Access the Application

- **Main Frontend:** http://localhost:8000/
- **Admin Interface:** http://localhost:8000/admin/
- **Health Check:** http://localhost:8000/core/health/

## Configuration

### Environment Variables

| Variable | Dev Default | Production | Description |
|----------|-------------|------------|-------------|
| `DJANGO_ENVIRONMENT` | `development` | `production` | Environment mode |
| `DJANGO_DEBUG` | `True` | `False` | Debug mode |
| `DJANGO_SECRET_KEY` | Auto-generated | Required | Django secret key |
| `DATABASE_URL` | SQLite | PostgreSQL | Database connection |
| `AWS_ACCESS_KEY_ID` | - | Required | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | - | Required | S3 secret key |
| `AWS_STORAGE_BUCKET_NAME` | - | Required | S3 bucket name |
| `USE_S3` | `False` | `True` | Enable S3 storage |

### Development vs Production

- **Development**: SQLite, local file storage, debug enabled
- **Production**: PostgreSQL, S3 storage, debug disabled, security headers

## Core Features

### Exercise Management
- **Staff CRUD Operations**: Create, read, update, delete exercises
- **User Access**: Authenticated users can view all exercises
- **Video Integration**: Exercises support video content

### Video Comments System
- **Video Comments**: Users create video comments using webcam or file upload
- **Webcam Recording**: Real-time video recording via MediaRecorder API
- **File Upload**: MP4, WebM, QuickTime, AVI formats (100MB max)
- **Permission System**: Role-based access control

### Security & Validation
- **File Validation**: Format and size restrictions enforced
- **Rate Limiting**: Basic rate limiting for uploads and requests
- **Input Sanitization**: XSS, SQL injection protection
- **Security Headers**: Comprehensive security headers

## UI Surfaces

### 1. Home/Feed
- Exercise list with video thumbnails
- Search and filtering capabilities
- Responsive grid layout

### 2. Exercise Detail
- Video player with exercise information
- Comment section below video
- Related exercises sidebar

### 3. Upload/Record
- Webcam recording interface
- File upload with drag-and-drop
- Preview and edit before submission

### 4. Login
- Session-based authentication
- Staff and regular user roles
- Secure password handling

### 5. Minimal Admin
- Exercise CRUD operations
- User management
- Content moderation tools

## API Map

### Core Endpoints
- `GET /` - Home page
- `GET /core/health/` - Health check
- `POST /core/api/upload-video/` - Video upload
- `GET /core/api/videos/` - List videos
- `DELETE /core/api/videos/{id}/delete/` - Delete video

### Exercise Endpoints
- `GET /exercises/` - Exercise list
- `GET /exercises/{id}/` - Exercise detail
- `POST /exercises/` - Create exercise (staff)
- `PATCH /exercises/{id}/` - Update exercise (staff)
- `DELETE /exercises/{id}/` - Delete exercise (staff)

### Comment Endpoints
- `GET /comments/` - Comment list
- `POST /comments/` - Create comment
- `PATCH /comments/{id}/` - Update comment
- `DELETE /comments/{id}/` - Delete comment

## Project Structure

```
Practika/
├── core/                    # Core functionality and VideoAsset model
│   ├── models.py           # VideoAsset model
│   ├── services/           # Storage services
│   ├── views.py            # Health check and video API
│   ├── middleware.py       # Security and monitoring
│   └── admin.py            # Admin interface
├── exercises/               # Exercise management
│   ├── models.py           # Exercise model
│   ├── views.py            # API and HTML views
│   ├── serializers.py      # DRF serializers
│   ├── permissions.py      # Custom permissions
│   └── templates/          # HTML templates
├── comments/                # Video comment management
│   ├── models.py           # VideoComment model
│   ├── views.py            # API views
│   ├── serializers.py      # DRF serializers
│   └── permissions.py      # Custom permissions
├── practika_project/        # Django project settings
│   ├── settings.py         # Base settings
│   ├── settings_production.py # Production settings
│   └── wsgi.py             # WSGI configuration
├── tests/                   # Test suite
├── media/                   # Video file storage
├── static/                  # Static files and icons
├── templates/               # Base templates
├── requirements.txt         # Dependencies
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Development environment
└── gunicorn.conf.py        # Production server config
```

## Testing

### Run Test Suite
```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_models.py -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=html

# Run tests in Docker
make test
```

### Test Coverage
- **Models**: Exercise, VideoAsset, VideoComment validation
- **Permissions**: Role-based access control
- **API Endpoints**: CRUD operations and validation
- **Security**: Rate limiting and input validation
- **UI Flows**: User interaction testing

## Deployment

### Heroku Container Deployment

```bash
# 1. Set environment variables
heroku config:set DJANGO_ENVIRONMENT=production
heroku config:set DJANGO_DEBUG=False
heroku config:set DJANGO_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"

# 2. Deploy container
heroku container:push web
heroku container:release web

# 3. Run migrations
heroku run python manage.py migrate

# 4. Collect static files
heroku run python manage.py collectstatic --noinput
```

### Automated Deployment
```bash
chmod +x deploy-heroku-simple.sh
./deploy-heroku-simple.sh
```

### Production Checklist
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Static files collected
- [ ] Health check passes
- [ ] All endpoints responding
- [ ] Logs showing no errors

## Operations & Health

### Health Endpoints
- **Liveness**: `GET /core/health/` - Basic system health
- **Response**: JSON with status, timestamp, and component checks

### Monitoring
- **Logs**: `heroku logs --tail`
- **Status**: `heroku ps`
- **Metrics**: Request timing and error rates

### Logging
- Request/response logging with unique IDs
- Performance monitoring for slow requests
- Error tracking and alerting

## Security Posture

### Validation
- File type and size validation
- Input sanitization and escaping
- SQL injection prevention

### Rate Limits
- Basic rate limiting on uploads
- Request throttling for API endpoints
- Account lockout after failed attempts

### Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 500 errors on Heroku | Missing middleware or settings | Check logs, verify production settings |
| Database connection failed | Missing DATABASE_URL | Set Heroku PostgreSQL addon |
| Static files not loading | collectstatic not run | Run `heroku run python manage.py collectstatic` |
| Video upload fails | File size/format invalid | Check file size (100MB max) and format |
| App won't start | Environment variables missing | Verify DJANGO_SECRET_KEY and DJANGO_ENVIRONMENT |
| Health check fails | Database or storage issues | Check database connection and file permissions |
| CORS errors | Origin not allowed | Update CORS_ALLOWED_ORIGINS in settings |
| Memory issues | Large video files | Optimize video size or increase dyno memory |
| Slow performance | Single worker process | Scale with `heroku ps:scale web=2` |
| Build fails | Dockerfile issues | Check Dockerfile syntax and dependencies |

### Debug Commands
```bash
# Check app status
heroku ps

# View logs
heroku logs --tail

# Check environment
heroku config

# Test database
heroku run python manage.py dbshell

# Check static files
heroku run python manage.py check --deploy
```

## Change Governance

### RFC Process
1. **Proposal**: Document feature request with scope impact
2. **Review**: Team review for scope alignment
3. **Approval**: Scope owner approval required
4. **Implementation**: Development with scope constraints
5. **Testing**: Comprehensive testing before deployment

### Scope Guardrails
- **No new models** without scope approval
- **No new UI surfaces** without scope approval
- **No new authentication methods** without scope approval
- **Maintain backward compatibility** for existing features
- **Security review required** for all changes

## Changelog

### Since Last README Update (August 25, 2025)
- **Refactored production settings** - Eliminated 500 errors on Heroku
- **Added missing middleware** - RequestLoggingMiddleware, SecurityMiddleware, etc.
- **Simplified container deployment** - Fixed Dockerfile and heroku.yml
- **Enhanced health monitoring** - Database and storage health checks
- **Consolidated documentation** - Single README as source of truth
- **Removed complex dependencies** - Redis, S3 made optional
- **Improved error handling** - Better logging and debugging capabilities

### Previous Major Changes
- **Initial deployment** - Basic Django app with video support
- **Container migration** - Moved from buildpack to container stack
- **Security hardening** - Added rate limiting and validation
- **Mobile optimization** - Responsive design and touch support

## License & Contact

- **License**: Proprietary - All rights reserved
- **Contact**: jacpagan1@gmail.com
- **Repository**: Private repository
- **Status**: Production ready on Heroku

---

**Practika v1** - Video-based learning platform for interactive exercises and video comments.