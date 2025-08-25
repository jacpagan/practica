# Practika Exercise Platform

A Django-based Learning Management System focused on video-based exercises and comments. This platform allows administrators to create exercises with video content and authenticated users to view exercises and create video comments.

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Development environment
make dev-up
# or
./docker-helper.sh dev-up

# Production environment
make prod-up
# or
./docker-helper.sh prod-up
```

### Option 2: Local Development

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

### Access the Application

- **Main Frontend:** http://localhost:8000/
- **Admin Interface:** http://localhost:8000/admin/
- **Login Page:** http://localhost:8000/login/
- **Health Check:** http://localhost:8000/health/

## 👥 User Accounts

### Admin User
- **Username:** `admin`
- **Password:** `admin123`
- **Capabilities:** Create exercises, manage all content, CRUD any video comments

### Regular User
- **Username:** `user`
- **Password:** `user123`
- **Capabilities:** View exercises, create video comments, reply to comments

## 📚 Core Features

### Exercise Management
- **Admin CRUD Operations**: Staff users can create, read, update, and delete exercises
- **User Exercise Access**: Authenticated users can view all exercises
- **Video Integration**: Exercises support video content with validation

### Video Comments System
- **Video Comments**: Users can create video comments on exercises using webcam recording or file upload
- **Webcam Recording**: Real-time video recording via MediaRecorder API
- **File Upload**: Support for video file uploads (MP4, WebM, QuickTime, AVI)
- **Permission System**: Role-based access control for exercises and comments

### Security & Validation
- **File Validation**: MP4, WebM, QuickTime, AVI formats only, 100MB maximum
- **Rate Limiting**: 5 login attempts per minute, 10 uploads per minute per IP
- **Account Lockout**: 5 minutes after 5 failed login attempts
- **Input Sanitization**: XSS, SQL injection, and command injection protection

## 🎨 Icon-First UI System

The application uses an SVG sprite system with consistent icon mappings across all templates. Icons are designed to be universally intuitive and accessible.

### Icon System Overview
- **File**: `/static/icons/icons.svg`
- **CSS**: `/static/css/icon-ui.css`
- **Default Mode**: Icon-only (`.icon-only` class on `<html>`)
- **Text Mode**: Add `?text=1` query parameter to reveal labels

### Core Icon Mappings
| Action | Icon ID | Description |
|--------|----------|-------------|
| **Home/Main Page** | `#home` | House icon for main page |
| **Exercise List** | `#list` | List icon for exercise overview |
| **Create Exercise** | `#new-ex` | Plus icon for new exercise creation |
| **Play Video** | `#play` | Play triangle for video playback |
| **Start Recording** | `#record` | Red circle for recording start |
| **Camera/Webcam** | `#camera` | Camera icon for webcam actions |
| **Upload/Submit** | `#upload` | Up arrow for file uploads |

### Accessibility Features
- **ARIA Labels**: Every interactive element includes screen reader descriptions
- **Keyboard Navigation**: Logical tab sequence with high-contrast focus rings
- **Screen Reader Support**: Hidden labels and meaningful icon descriptions
- **Icon Legend**: Modal overlay showing icon meanings (toggle with ⓘ button)

## 🛠️ Technology Stack

### Backend
- **Framework**: Django 4.2 + Django REST Framework
- **Database**: SQLite (development), PostgreSQL (production)
- **Storage**: FileSystemStorage (local) + S3 (cloud)
- **Authentication**: Session-based authentication
- **Caching**: Redis

### Frontend
- **Templates**: Server-rendered HTML with Django templates
- **JavaScript**: ES6+ with MediaRecorder API for video recording
- **CSS**: Custom icon-first UI system
- **Video Support**: MP4, WebM, QuickTime, AVI formats

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Deployment**: Heroku-ready with Procfile and buildpacks
- **Monitoring**: Health checks, metrics, and logging
- **Security**: Rate limiting, input validation, security headers

## 📁 Project Structure

```
Practika/
├── core/                    # Core functionality and VideoAsset model
│   ├── models.py           # VideoAsset model with validation
│   ├── services/           # Storage and cloud storage services
│   ├── views.py            # Health check and video API endpoints
│   ├── middleware.py       # Security and monitoring middleware
│   ├── security.py         # Security validation and auditing
│   └── admin.py            # Admin interface for VideoAsset
├── exercises/               # Exercise management
│   ├── models.py           # Exercise model
│   ├── views.py            # API ViewSets and HTML views
│   ├── serializers.py      # DRF serializers
│   ├── permissions.py      # Custom permissions
│   ├── admin.py            # Admin interface
│   ├── templates/          # HTML templates
│   └── html_views.py       # HTML views for web interface
├── comments/                # Video comment management
│   ├── models.py           # VideoComment model
│   ├── views.py            # API ViewSets
│   ├── serializers.py      # DRF serializers
│   ├── permissions.py      # Custom permissions
│   └── admin.py            # Admin interface
├── tests/                   # Comprehensive test suite
│   ├── test_models.py      # Model tests
│   ├── test_permissions.py # Permission tests
│   ├── test_api_exercises.py # Exercise API tests
│   ├── test_api_comments.py # Comment API tests
│   ├── test_media_validation.py # Media validation tests
│   ├── test_security.py    # Security and rate limiting tests
│   ├── test_a11y_icons.py # Icon accessibility tests
│   └── test_ui_nonreader_flow.py # UI flow tests
├── practika_project/        # Django project settings
├── media/                   # Video file storage
├── static/                  # Static files and icons
├── templates/               # Base templates
├── requirements.txt         # Production dependencies
├── requirements-dev.txt     # Development dependencies
├── pytest.ini              # Pytest configuration
├── Dockerfile              # Development Docker image
├── Dockerfile.prod         # Production Docker image
├── docker-compose.yml      # Development environment
├── docker-compose.prod.yml # Production environment
└── README.md               # This file
```

## 🐳 Docker Setup

### Development Environment
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

### Production Environment
```bash
# Start production environment
make prod-up

# View production logs
make logs-prod

# Stop production services
make prod-down
```

### Available Commands
```bash
make help              # Show all available commands
make status            # Check service status
make shell             # Open Django shell
make clean             # Clean up all containers
```

## 🔌 API Endpoints

### Exercises
- `GET /api/exercises/` - List all exercises (authenticated)
- `POST /api/exercises/` - Create exercise (staff only)
- `GET /api/exercises/{id}/` - Get exercise details (authenticated)
- `PATCH /api/exercises/{id}/` - Update exercise (staff only)
- `DELETE /api/exercises/{id}/` - Delete exercise (staff only)

### Video Comments
- `GET /api/video-comments/` - List all comments (authenticated)
- `POST /api/video-comments/` - Create comment (authenticated)
- `GET /api/video-comments/{id}/` - Get comment details (authenticated)
- `PATCH /api/video-comments/{id}/` - Update comment (author or staff)
- `DELETE /api/video-comments/{id}/` - Delete comment (author or staff)

### Video Upload (Core)
- `POST /core/api/upload-video/` - Upload video file (authenticated)
- `GET /core/api/videos/` - List uploaded videos (authenticated)
- `DELETE /core/api/videos/{id}/delete/` - Delete video (authenticated)

### Health & Monitoring
- `GET /health/` - System health check
- `GET /api/health/` - Detailed health status
- `GET /api/metrics/` - Prometheus-style metrics

## 🎥 Video System Features

### Webcam Integration
- **Technology**: MediaRecorder API
- **Format**: WebM with VP8 video + Opus audio
- **Features**: Live preview, start/stop controls, playback review

### Video Upload
- **Accepted Formats**: MP4, WebM, QuickTime, AVI
- **Size Limit**: 100MB
- **Processing**: SHA256 checksums, metadata extraction
- **Storage**: Local filesystem with S3 fallback

### Storage Strategy
- **Primary**: S3 bucket with public read access
- **Fallback**: Local filesystem storage
- **Organization**: UUID-based naming with metadata tracking

## 🧪 Testing

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
- **Total Tests**: 9 test files
- **Test Areas**: Models, permissions, API endpoints, media validation, security, accessibility, UI flows

## 🚀 Deployment

### Heroku Container Deployment (Recommended)

This is the **recommended deployment method** for production use with Docker containers.

#### Prerequisites
- Heroku CLI installed and logged in
- Docker Desktop running
- Git repository initialized

#### Quick Deploy Commands

```bash
# 1. Set up Heroku app (if not exists)
heroku create your-app-name
# or use existing: heroku git:remote -a your-app-name

# 2. Set required environment variables
heroku config:set DJANGO_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(50))')"
heroku config:set DJANGO_ENVIRONMENT=production
heroku config:set DJANGO_DEBUG=False
heroku config:set DJANGO_SETTINGS_MODULE=practika_project.production

# 3. Set database (PostgreSQL recommended for production)
heroku addons:create heroku-postgresql:mini

# 4. Set Redis for caching
heroku addons:create heroku-redis:mini

# 5. Deploy with container stack
git add .
git commit -m "Deploy to Heroku with container stack"
git push heroku main

# 6. Run migrations and collect static
heroku run python manage.py migrate
heroku run python manage.py collectstatic --noinput

# 7. Create superuser
heroku run python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"
```

#### Container Stack Configuration

The deployment uses `heroku.yml` for container stack configuration:

- **Build Phase**: Uses `Dockerfile.prod` for optimized production image
- **Release Phase**: Runs migrations and collects static files
- **Run Phase**: Starts Gunicorn with production settings

#### Environment Variables

**Required:**
```bash
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_ENVIRONMENT=production
DJANGO_DEBUG=False
DJANGO_SETTINGS_MODULE=practika_project.production
```

**Optional (S3 Storage):**
```bash
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=your-s3-bucket
AWS_S3_REGION_NAME=us-east-1
```

**Optional (Performance):**
```bash
GUNICORN_WORKERS=1
GUNICORN_TIMEOUT=30
GUNICORN_LOG_LEVEL=info
```

#### Monitoring and Debugging

```bash
# View real-time logs
heroku logs --tail

# Check app status
heroku ps

# Run Django shell
heroku run python manage.py shell

# Check environment variables
heroku config

# Restart app
heroku restart
```

#### Troubleshooting Container Deployments

**Common Issues:**
1. **Build fails**: Check Dockerfile.prod syntax and requirements.txt
2. **App won't start**: Check logs with `heroku logs --tail`
3. **Static files missing**: Ensure collectstatic runs in release phase
4. **Database connection**: Verify DATABASE_URL is set
5. **Port binding**: Gunicorn automatically binds to $PORT

**Debug Commands:**
```bash
# Check build logs
heroku builds:output

# View release phase logs
heroku releases:info

# Test app locally with Docker
docker build -f Dockerfile.prod -t practika-prod .
docker run -p 8000:8000 -e PORT=8000 practika-prod
```

### Heroku Deployment (Legacy)
