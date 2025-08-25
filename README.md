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

### Heroku Deployment
```bash
# Deploy to Heroku
./deploy-heroku.sh

# Check deployment status
heroku logs --tail --app your-app-name
```

### Environment Variables
```bash
# Required for production
DJANGO_SECRET_KEY=your-production-secret-key
DJANGO_ENVIRONMENT=production
DJANGO_DEBUG=False

# S3 Configuration (optional)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_STORAGE_BUCKET_NAME=your_bucket_name
AWS_S3_REGION_NAME=us-east-1
```

## 🔒 Security Features

### Authentication & Login Security
- **Rate Limiting**: 5 login attempts per minute per IP address
- **Account Lockout**: 5 minutes after 5 failed login attempts
- **Password Security**: Minimum 8 characters with complexity requirements
- **Session Security**: 1 hour timeout with secure cookies

### File Upload Security
- **Video File Validation**: MP4, WebM, QuickTime, AVI formats only
- **File Size Limit**: 100MB maximum
- **Malware Protection**: Executable and script detection
- **Content Validation**: Magic bytes and header analysis

### Security Monitoring
- **Security Events Logged**: Failed logins, account lockouts, rate limit violations
- **Audit Trail**: User actions, resource access, security violations
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection

## 📱 Browser Compatibility

### Required Features
- **MediaRecorder API**: For video recording
- **getUserMedia**: For camera/microphone access
- **Modern JavaScript**: ES6+ features
- **HTML5 Video**: For video playback

### Supported Browsers
- **Chrome**: 47+ (full support)
- **Firefox**: 44+ (full support)
- **Safari**: 14.1+ (limited support)
- **Edge**: 79+ (full support)

## 🔧 Development

### Code Quality
- **Testing**: pytest + pytest-django
- **Code Style**: Follow Django coding standards
- **Linting**: ruff for code quality
- **Formatting**: black for consistent formatting

### Adding New Features
1. Write tests first (TDD approach)
2. Implement the feature
3. Ensure all tests pass
4. Update documentation

## 🚨 Troubleshooting

### Common Issues

1. **Camera Not Working**: Check browser permissions, ensure HTTPS in production
2. **Video Upload Fails**: Check file size (max 100MB), verify file format
3. **Page Not Loading**: Check Django server, verify database migrations
4. **libmagic Issues**: Install with `brew install libmagic` on macOS
5. **Docker Issues**: Use `make logs` to view container logs

### Debug Mode
- **Console Logging**: Detailed error information
- **Performance Metrics**: Recording and upload timing
- **State Inspection**: Current recorder status
- **Network Monitoring**: API call tracking

## 📊 Dependencies

### Production Dependencies
- Django 4.2+
- Django REST Framework
- Pillow (image processing)
- python-magic (file type detection)
- django-filter
- django-cors-headers
- psutil (system monitoring)
- redis (caching)
- django-prometheus (metrics)
- django-health-check (health monitoring)
- whitenoise (static files)
- gunicorn (WSGI server)
- boto3 (AWS S3)

### Development Dependencies
- pytest
- pytest-django
- model-bakery
- ruff
- black

## 🔮 Future Enhancements

### Planned Features
- **Real-time Comments**: WebSocket integration
- **Video Processing**: Thumbnail generation, transcoding
- **User Profiles**: Avatar and bio support
- **Search & Filter**: Advanced exercise discovery
- **Mobile App**: React Native companion
- **AI-powered Suggestions**: Content improvement recommendations
- **Advanced Analytics**: Detailed engagement insights
- **Social Features**: Community challenges and competitions

### Technical Improvements
- **CDN Integration**: CloudFront for video delivery
- **Video Compression**: Automatic optimization
- **Analytics**: User engagement tracking
- **Caching**: Redis-based performance optimization
- **WebSocket Integration**: Real-time updates
- **Progressive Web App**: Offline functionality

## 📚 Additional Resources

### Security Documentation
- [Django Security Documentation](https://docs.djangoproject.com/en/stable/topics/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Security Headers](https://securityheaders.com/)

### Development Tools
- [Bandit](https://bandit.readthedocs.io/) - Python security linter
- [Safety](https://pyup.io/safety/) - Dependency vulnerability checker
- [Django Debug Toolbar](https://django-debug-toolbar.readthedocs.io/) - Security inspection

### Docker Resources
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)

## 📝 License

This project is for educational and development purposes.

---

**A simple, focused Practika platform for video-based learning exercises with accessibility features.**

**Built with Django, HTML5, and modern JavaScript**  
**Video recording powered by MediaRecorder API**  
**Responsive design for all devices**  
**Icon-first UI for universal accessibility**  
**Production-ready with Docker and Heroku deployment**
