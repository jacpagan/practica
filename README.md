# LMS Exercise Platform

A Django-based Learning Management System focused on video-based exercises and comments. This platform allows administrators to create exercises with video content and authenticated users to view exercises and create video comments.

## Features

- **Admin CRUD Operations**: Staff users can create, read, update, and delete exercises
- **User Exercise Access**: Authenticated users can view all exercises
- **Video Comments**: Users can create video comments on exercises using webcam recording or file upload
- **Permission System**: Role-based access control for exercises and comments
- **Video Storage**: Local file storage with MIME type validation and checksum calculation
- **Basic Video Recording**: Webcam recording functionality for creating exercises and comments

## Technology Stack

- **Backend**: Django 4.2 + Django REST Framework
- **Database**: SQLite (local development)
- **Storage**: FileSystemStorage at `./media`
- **Authentication**: Session-based authentication
- **Frontend**: Server-rendered HTML with JavaScript for webcam recording
- **Video Support**: MP4, WebM, QuickTime, AVI formats

## Setup Instructions

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

## Project Structure

```
LMS/
├── core/                    # Core functionality and VideoAsset model
│   ├── models.py           # VideoAsset model with validation and monitoring
│   ├── services/           # Storage service for video files
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
│   └── test_media_validation.py # Media validation tests
├── lms_project/            # Django project settings
├── media/                  # Video file storage
├── requirements.txt        # Production dependencies
├── requirements-dev.txt    # Development dependencies
├── pytest.ini             # Pytest configuration
└── README.md               # This file
```

## Core Functionality

### Exercise Management
- **Create Exercises**: Staff users can create exercises with video content
- **Video Input**: Support for both webcam recording and file upload
- **Exercise Details**: View exercise information and associated video

### Video Comments
- **Create Comments**: Authenticated users can add video comments to exercises
- **Webcam Recording**: Record video comments directly in the browser
- **File Upload**: Upload video files as comments
- **Comment Display**: View all comments on an exercise

### Video Asset Management
- **File Validation**: MIME type and format validation
- **Integrity Checks**: SHA256 checksum calculation
- **Storage Management**: Organized file storage with metadata tracking
- **Access Monitoring**: Track file access and usage statistics

## API Endpoints

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

## Supported Video Formats

- MP4 (`video/mp4`)
- WebM (`video/webm`)
- QuickTime (`video/quicktime`)
- AVI (`video/x-msvideo`)

## File Upload Limits

- Maximum file size: 100MB
- Video files are stored in `./media/videos/`
- Automatic checksum calculation (SHA256)
- MIME type validation

## Testing

Run the test suite:

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_models.py -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=html
```

## Development

### Code Quality

- **Testing**: pytest + pytest-django
- **Code Style**: Follow Django coding standards

### Adding New Features

1. Write tests first (TDD approach)
2. Implement the feature
3. Ensure all tests pass
4. Update documentation

## Security Features

- Session-based authentication
- Role-based permissions
- CSRF protection
- File type validation
- Input sanitization
- Rate limiting for login attempts
- Account lockout protection

## Local Development Notes

- Database: SQLite (in-memory for tests)
- Media files: Stored locally in `./media/`
- No external services or cloud dependencies
- Webcam recording uses MediaRecorder API (WebM format)
- Basic video recording and playback functionality

## User Workflow

### For Staff Users
1. **Create Exercise**: Navigate to `/create/` to create new exercises
2. **Upload Video**: Record with webcam or upload video file
3. **Manage Content**: Use admin interface to manage exercises and users

### For Regular Users
1. **Browse Exercises**: View all available exercises on the main page
2. **Watch Videos**: Play exercise videos to learn
3. **Add Comments**: Record or upload video comments to exercises
4. **Engage**: View other users' comments and feedback

## Troubleshooting

### libmagic Issues
If you encounter libmagic errors:
```bash
brew install libmagic
```

### Test Database Issues
If tests fail due to database constraints:
```bash
python manage.py flush  # Clear test data
python manage.py migrate  # Re-run migrations
```

### Video Upload Issues
- Ensure video file is one of the supported formats
- Check file size (max 100MB)
- Verify MIME type detection

### Webcam Recording Issues
- Check browser MediaRecorder API support
- Verify camera permissions
- Ensure HTTPS in production (required for camera access)

## Dependencies

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

## License

This project is for educational and development purposes.

---

**A simple, focused LMS platform for video-based learning exercises.**
