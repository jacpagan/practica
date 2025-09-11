# Practika Project Overview & Development Guide

## 🎯 Project Overview and Goals

**Practika** is a comprehensive video-based learning platform designed for skill practice and feedback. The system enables students to upload practice videos, receive structured feedback from teachers, and engage in threaded conversations around specific video segments.

### Core Mission
- **Student Practice**: Upload video recordings of skill practice (music, sports, language, etc.)
- **Teacher Feedback**: Provide timestamped feedback with video replies
- **Segmented Learning**: Break long videos into focused practice segments
- **Threaded Conversations**: Discuss specific moments in practice videos
- **Progress Tracking**: Monitor learning progress through structured exercises

### Key Features
- Video upload and processing with HLS streaming
- Video segmentation for focused practice
- Threaded conversation system
- Role-based access (students, teachers, admins)
- Course and lesson management
- Real-time video processing with Celery
- AWS S3 + CloudFront integration

## 🏗️ Architecture Decisions

### Backend Architecture
- **Framework**: Django 5.0.6 with Django REST Framework
- **Database**: PostgreSQL (production) / SQLite (development)
- **Task Queue**: Celery with Redis broker
- **Storage**: AWS S3 with CloudFront CDN
- **Authentication**: Token-based authentication
- **API Documentation**: drf-spectacular (OpenAPI/Swagger)

### Application Structure
```
backend/
├── config/           # Django settings and configuration
├── auth_users/       # Custom user model with roles
├── course_app/       # Course, Module, Lesson management
├── clip_app/         # Core practice video functionality
├── api_app/          # REST API endpoints and serializers
├── video_app/        # Video processing tasks (Celery)
├── web_app/          # Web interface views
└── analytics_app/    # Analytics and reporting
```

### Data Model Hierarchy
```
Course → Module → Lesson → Exercise
                           ↓
                    PracticeClip → VideoSegment → PracticeThread → ThreadMessage
                           ↓
                       Feedback → FeedbackMarker
```

### Key Design Patterns
- **UUID Primary Keys**: All models use UUID for security and scalability
- **Status Tracking**: PracticeClip and VideoSegment use status enums
- **Async Processing**: Video transcoding handled by Celery workers
- **Presigned URLs**: Secure S3 uploads without exposing credentials
- **Role-Based Access**: Teacher/Student/Admin permissions

## 📋 Coding Conventions

### Python Standards
- **Code Style**: Black formatter (100 char line length)
- **Linting**: Ruff for fast Python linting
- **Type Checking**: MyPy with strict mode
- **Dependencies**: No version pinning in requirements.txt (user rule)

### Django Patterns
- **Model Fields**: Explicit field definitions with proper constraints
- **Serializers**: Separate serializers for API responses
- **ViewSets**: RESTful API endpoints using DRF ViewSets
- **Permissions**: Token authentication with role-based access
- **Database**: Use select_related() for foreign key optimization

### API Design
- **RESTful Endpoints**: `/api/v1/` prefix for versioning
- **HTTP Methods**: Proper use of GET/POST/PUT/DELETE
- **Status Codes**: Appropriate HTTP status codes
- **Error Handling**: Consistent error response format
- **Authentication**: Token-based with Authorization header

### File Organization
- **Models**: One model per file, clear relationships
- **Views**: ViewSets with custom actions for complex operations
- **Serializers**: Separate serializers for different use cases
- **Tasks**: Celery tasks for async video processing
- **Templates**: Django templates for web interface

## 🚀 Current Priorities

### Phase 1: Core Platform (Current)
- ✅ Video upload and processing pipeline
- ✅ Basic practice clip management
- ✅ Teacher feedback system
- ✅ Video segmentation
- ✅ Threaded conversations
- ✅ Python SDK implementation

### Phase 2: Enhanced Features (Next)
- 🔄 Advanced video analytics
- 🔄 Real-time notifications
- 🔄 Mobile-responsive web interface
- 🔄 Batch video processing
- 🔄 Advanced search and filtering

### Phase 3: Production Readiness
- 🔄 AWS deployment automation
- 🔄 Monitoring and logging
- 🔄 Performance optimization
- 🔄 Security hardening
- 🔄 Backup and recovery

## 🛠️ Development Workflow

### Local Development
```bash
# Start development environment
make dev

# Run migrations
make migrate

# Create superuser
make superuser

# Run tests
make test

# Code quality checks
make lint
make type
```

### API Testing
- **Swagger UI**: `http://localhost:8000/docs/`
- **Admin Panel**: `http://localhost:8000/admin/`
- **Test Interface**: `http://localhost:8000/api/test/`

### SDK Usage
```python
from practika.client import Practika

# Initialize client
client = Practika('http://localhost:8000', 'your-token')

# Complete workflow
exercises = client.exercises()
upload_data = client.request_upload(exercise_id, duration_sec)
# Upload video to upload_data['url']
client.commit(upload_data['clip_id'])
status = client.status(upload_data['clip_id'])
streams = client.streams(upload_data['clip_id'])
```

## 🔧 Technical Stack

### Backend Services
- **Django 5.0.6**: Web framework
- **PostgreSQL**: Primary database
- **Redis**: Celery broker and caching
- **Celery**: Async task processing
- **FFmpeg**: Video processing
- **AWS S3**: File storage
- **CloudFront**: CDN and streaming

### Development Tools
- **Docker**: Containerization
- **Docker Compose**: Multi-service orchestration
- **Black**: Code formatting
- **Ruff**: Fast Python linting
- **MyPy**: Static type checking
- **pytest**: Testing framework

### Deployment
- **AWS ECS**: Container orchestration
- **AWS ECR**: Container registry
- **AWS RDS**: Managed PostgreSQL
- **AWS ElastiCache**: Managed Redis
- **GitHub Actions**: CI/CD pipeline

## 📊 Key Metrics & Monitoring

### Performance Targets
- Video upload: < 30 seconds for 100MB files
- Processing time: < 2 minutes for 10-minute videos
- API response: < 200ms for standard operations
- Concurrent users: 100+ simultaneous uploads

### Quality Gates
- All tests must pass
- Code coverage > 80%
- No linting errors
- Type checking passes
- Security scan clean

## 🎯 Success Criteria

### MVP Completion
- [x] Students can upload practice videos
- [x] Teachers can provide timestamped feedback
- [x] Video segmentation works reliably
- [x] Threaded conversations function properly
- [x] Python SDK is fully functional
- [x] Web interface is responsive and intuitive

### Production Readiness
- [ ] AWS deployment is automated
- [ ] Monitoring and alerting configured
- [ ] Performance meets targets
- [ ] Security audit completed
- [ ] Documentation is comprehensive
- [ ] User onboarding is smooth

This documentation serves as the definitive guide for understanding Practika's architecture, development patterns, and current priorities. It should be updated as the project evolves and new features are added.
