# LMS Exercise Platform

A Django-based Learning Management System focused on video-based exercises and comments. This platform allows administrators to create exercises with video content and authenticated users to view exercises and create video comments.

## 🚀 New: Video Creation Loop System

The platform now includes an advanced **Video Creation Loop** system designed to keep users continuously engaged in creating video content:

- **🎬 Video Creation Hub**: Dedicated space for continuous video creation
- **🔄 Continuous Recording Mode**: Auto-reset after submissions for seamless workflow
- **📦 Bulk Upload System**: Build up multiple recordings and upload all at once
- **🎯 Engagement Gamification**: Streak tracking, progress metrics, and motivational messages
- **🚀 Quick Session Mode**: Rapid-fire video creation for power users

**Access the Video Hub**: Navigate to `/hub/` or click "🎬 Video Hub" in the navigation

## Features

- **Admin CRUD Operations**: Staff users can create, read, update, and delete exercises
- **User Exercise Access**: Authenticated users can view all exercises
- **Video Comments**: Users can create video comments on exercises using webcam recording or file upload
- **Permission System**: Role-based access control for exercises and comments
- **Video Storage**: Local file storage with MIME type validation and checksum calculation
- **🎬 Continuous Engagement**: Advanced video creation loop that keeps users engaged

## Technology Stack

- **Backend**: Django 5.x + Django REST Framework 3.15+
- **Database**: SQLite (local development)
- **Storage**: FileSystemStorage at `./media`
- **Authentication**: Session-based authentication
- **Frontend**: Server-rendered HTML with minimal JavaScript for webcam recording
- **🎥 Video Loop**: Enhanced JavaScript with MediaRecorder API and engagement features

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
   - Exercise list: http://localhost:8000/ex/
   - **🎬 Video Hub**: http://localhost:8000/ex/hub/
   - API endpoints: http://localhost:8000/api/v1/

## Project Structure

```
LMS/
├── core/                    # Core functionality and VideoAsset model
│   ├── models.py           # VideoAsset model
│   ├── services/           # Storage service for video files
│   └── admin.py            # Admin interface for VideoAsset
├── exercises/               # Exercise management
│   ├── models.py           # Exercise model
│   ├── views.py            # API ViewSets
│   ├── serializers.py      # DRF serializers
│   ├── permissions.py      # Custom permissions
│   ├── admin.py            # Admin interface
│   ├── templates/          # HTML templates
│   │   ├── exercises/      # Exercise templates
│   │   └── video_hub.html  # 🎬 Video Creation Hub
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
├── VIDEO_LOOP_README.md    # 🎬 Video Creation Loop documentation
└── README.md               # This file
```

## 🎬 Video Creation Loop Features

### Continuous Recording Mode
- **Auto-reset**: Recorder automatically resets after each submission
- **Seamless Flow**: No page reloads or interruptions
- **Visual Feedback**: Clear indicators for active continuous mode

### Bulk Upload System
- **Recording Queue**: Build up multiple videos before uploading
- **Batch Processing**: Upload all recordings at once with progress tracking
- **Queue Management**: Add, remove, and edit queued recordings

### Video Creation Hub
- **Centralized Space**: Dedicated location for all video activities
- **Multiple Modes**: Quick session, targeted exercise, and free-form recording
- **Progress Tracking**: Real-time statistics and achievements

### Engagement Gamification
- **Streak Tracking**: Daily contribution streaks
- **Progress Metrics**: Session recordings, total contributions, community impact
- **Motivational Messages**: Dynamic encouragement that rotates automatically

## API Endpoints

### Exercises
- `GET /api/v1/exercises/` - List all exercises (authenticated)
- `POST /api/v1/exercises/` - Create exercise (staff only)
- `GET /api/v1/exercises/{id}/` - Get exercise details (authenticated)
- `PATCH /api/v1/exercises/{id}/` - Update exercise (staff only)
- `DELETE /api/v1/exercises/{id}/` - Delete exercise (staff only)

### Video Comments
- `GET /api/v1/video-comments/` - List all comments (authenticated)
- `POST /api/v1/video-comments/` - Create comment (authenticated)
- `GET /api/v1/video-comments/{id}/` - Get comment details (authenticated)
- `PATCH /api/v1/video-comments/{id}/` - Update comment (author or staff)
- `DELETE /api/v1/video-comments/{id}/` - Delete comment (author or staff)

## Supported Video Formats

- MP4 (`video/mp4`)
- WebM (`video/webm`)
- QuickTime (`video/quicktime`)

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

- **Formatting**: Black
- **Linting**: Ruff
- **Testing**: pytest + pytest-django

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

## Local Development Notes

- Database: SQLite (in-memory for tests)
- Media files: Stored locally in `./media/`
- No external services or cloud dependencies
- Webcam recording uses MediaRecorder API (WebM format)
- **🎬 Video Loop**: Enhanced engagement features with local storage

## 🎯 User Engagement Strategy

The platform implements a comprehensive engagement loop:

1. **Easy Access**: One-click video recording with webcam
2. **Continuous Flow**: Auto-reset and seamless workflow
3. **Progress Tracking**: Visual feedback and statistics
4. **Gamification**: Streaks, achievements, and motivation
5. **Community Building**: Shared content and interactions

This creates a positive feedback loop where users want to keep creating content, building a rich learning environment.

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

### 🎬 Video Loop Issues
- Check browser MediaRecorder API support
- Verify camera permissions
- Clear browser storage if queue issues occur
- Check console for JavaScript errors

## 📚 Additional Documentation

- **VIDEO_LOOP_README.md**: Comprehensive guide to the video creation loop system
- **COMPLIANCE.md**: Feature compliance and testing status
- **FRONTEND_README.md**: Frontend implementation details

## License

This project is for educational and development purposes.

---

**🎬 Transform your LMS into an engaging video creation platform!**
