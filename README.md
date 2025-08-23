# LMS Exercise Platform

A Django-based Learning Management System focused on video-based exercises and comments. This platform allows administrators to create exercises with video content and authenticated users to view exercises and create video comments.

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   source .venv/bin/activate
   python manage.py runserver
   ```

2. **Access the application:**
   - **Main Frontend:** http://localhost:8000/
   - **Admin Interface:** http://localhost:8000/admin/
   - **Login Page:** http://localhost:8000/login/

## 👥 User Accounts

### Admin User
- **Username:** `admin`
- **Password:** `admin123`
- **Capabilities:** Create exercises, manage all content, CRUD any video comments

### Regular User
- **Username:** `user`
- **Password:** `user123`
- **Capabilities:** View exercises, create video comments, reply to comments

## 📚 Features

- **Admin CRUD Operations**: Staff users can create, read, update, and delete exercises
- **User Exercise Access**: Authenticated users can view all exercises
- **Video Comments**: Users can create video comments on exercises using webcam recording or file upload
- **Permission System**: Role-based access control for exercises and comments
- **Video Storage**: Local file storage with MIME type validation and checksum calculation
- **Basic Video Recording**: Webcam recording functionality for creating exercises and comments
- **Icon-First UI**: Accessible interface with comprehensive icon system

## 🎨 Icon-First UI System

The application uses an SVG sprite system with consistent icon mappings across all templates. Icons are designed to be universally intuitive and accessible, with proper ARIA labels and screen reader support.

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

## 🔐 Security Features

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

## 🛠️ Technology Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Database**: SQLite (local development)
- **Storage**: FileSystemStorage at `./media`
- **Authentication**: Session-based authentication
- **Frontend**: Server-rendered HTML with JavaScript for webcam recording
- **Video Support**: MP4, WebM, QuickTime, AVI formats

## 📁 Project Structure

```
LMS/
├── core/                    # Core functionality and VideoAsset model
│   ├── models.py           # VideoAsset model with validation and monitoring
│   ├── services/           # Storage service for video files
│   ├── views.py            # Health check and monitoring endpoints
│   ├── middleware.py       # Security and rate limiting middleware
│   └── admin.py            # Admin interface for VideoAsset
├── exercises/               # Exercise management
│   ├── models.py           # Exercise model
│   ├── views.py            # API ViewSets and HTML views
│   ├── serializers.py      # DRF serializers
│   ├── permissions.py      # Custom permissions
│   ├── admin.py            # Admin interface
│   ├── templates/          # HTML templates
│   │   ├── exercises/      # Exercise templates
│   │   └── base.html       # Base template
│   └── html_views.py       # HTML views for web interface
├── comments/                # Video comment management
│   ├── models.py           # VideoComment model
│   ├── views.py            # API ViewSets
│   ├── serializers.py      # DRF serializers
│   ├── permissions.py      # Custom permissions
│   └── admin.py            # Admin interface
├── tests/                   # Test suite
│   ├── test_models.py      # Model tests
│   ├── test_permissions.py # Permission tests
│   ├── test_api_exercises.py # Exercise API tests
│   ├── test_api_comments.py # Comment API tests
│   ├── test_media_validation.py # Media validation tests
│   ├── test_security.py    # Security and rate limiting tests
│   ├── test_a11y_icons.py # Icon accessibility tests
│   └── test_ui_nonreader_flow.py # UI flow tests
├── lms_project/            # Django project settings
├── media/                  # Video file storage
├── requirements.txt        # Production dependencies
├── requirements-dev.txt    # Development dependencies
├── pytest.ini             # Pytest configuration
└── README.md               # This file
```

## 🚀 Setup Instructions

### Prerequisites

- Python 3.9+
- macOS (for libmagic support)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LMS
   ```

2. **Create and activate virtual environment**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install system dependencies (macOS)**
   ```bash
   brew install libmagic
   ```

5. **Run migrations**
   ```bash
   python manage.py migrate
   ```

6. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

7. **Run the development server**
   ```bash
   python manage.py runserver
   ```

8. **Access the application**
   - Admin interface: http://localhost:8000/admin/
   - Exercise list: http://localhost:8000/
   - Exercise creation: http://localhost:8000/create/
   - API endpoints: http://localhost:8000/api/

## 📱 User Stories Covered

### 1. Admin Creates Exercise
- **Path:** `/create/` (admin only)
- **Features:**
  - Upload video files (MP4, WebM, QuickTime, AVI)
  - Set exercise name (≤140 characters)
  - Add optional description
  - Video preview before upload
  - Form validation and error handling

### 2. Users Watch Exercises
- **Path:** `/` (main page)
- **Features:**
  - View all available exercises
  - Watch exercise videos with HTML5 player
  - See exercise metadata (creator, date, description)
  - Responsive grid layout

### 3. Users Create Video Comments
- **Path:** `/` (on any exercise)
- **Features:**
  - Webcam recording via MediaRecorder API
  - Optional text comments
  - Real-time video preview
  - Start/stop recording controls
  - Automatic video upload on submission

### 4. Admin Comments on User Comments
- **Path:** `/` (reply to any comment)
- **Features:**
  - Reply to any video comment with video
  - Admin badge identification
  - Nested comment structure
  - Same video recording interface

## 🎥 Video Recording Features

### Webcam Integration
- **Technology:** MediaRecorder API
- **Format:** WebM with VP8 video + Opus audio
- **Features:**
  - Live preview during recording
  - Start/stop controls
  - Playback of recorded video
  - Automatic blob creation for upload

### Video Upload
- **Accepted Formats:** MP4, WebM, QuickTime, AVI
- **Size Limit:** 100MB
- **Processing:** SHA256 checksums, metadata extraction
- **Storage:** Local filesystem with UUID naming

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

### Health & Monitoring
- `GET /health/` - System health check
- `GET /api/health/` - Detailed health status
- `GET /api/metrics/` - Prometheus-style metrics

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_models.py -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=html
```

### Test Coverage

- **Total Tests**: 8 test files
- **Test Areas**:
  - Model validation and constraints
  - Permission system
  - API endpoints
  - Media validation
  - CRUD operations
  - Icon accessibility
  - UI non-reader flows
  - Security and rate limiting

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
- django-debug-toolbar (development)

### Development Dependencies
- pytest
- pytest-django
- model-bakery
- ruff
- black

## 🔮 Future Enhancements

### Planned Features
- **Real-time Comments**: WebSocket integration
- **Video Processing**: Thumbnail generation
- **User Profiles**: Avatar and bio support
- **Search & Filter**: Advanced exercise discovery
- **Mobile App**: React Native companion
- **AI-powered Suggestions**: Content improvement recommendations
- **Advanced Analytics**: Detailed engagement insights
- **Social Features**: Community challenges and competitions

### Technical Improvements
- **CDN Integration**: Cloud video storage
- **Video Compression**: Automatic optimization
- **Analytics**: User engagement tracking
- **Caching**: Redis-based performance
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

## 📝 License

This project is for educational and development purposes.

---

**A simple, focused LMS platform for video-based learning exercises with accessibility features.**

**Built with Django, HTML5, and modern JavaScript**  
**Video recording powered by MediaRecorder API**  
**Responsive design for all devices**  
**Icon-first UI for universal accessibility**
