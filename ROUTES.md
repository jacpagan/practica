# Practika Routes Documentation

## Root URLs (`practika_project/urls.py`)
```
/                           # Simple home page (text response)
/core/                      # Core functionality routes
/exercises/                 # Exercise management routes  
/comments/                  # Video comment routes
```

## Core App Routes (`core/urls.py`)
```
/core/health/               # Health check endpoint
/core/metrics/              # Prometheus metrics (out-of-scope)
/core/logs/                 # Log viewing (out-of-scope)
/core/test/                 # Test endpoint (out-of-scope)
/core/api/upload-video/     # Video upload API
/core/api/videos/           # List videos API
/core/api/videos/<uuid>/delete/  # Delete video API
/core/upload-test/          # Upload test page (out-of-scope)
/core/debug-settings/       # Debug settings (out-of-scope)
```

## Exercises App Routes (`exercises/urls.py`)
```
/exercises/                 # Exercise list page (home/feed)
/exercises/login/           # User login
/exercises/logout/          # User logout
/exercises/create/          # Create exercise page
/exercises/exercise/<uuid>/ # Exercise detail page
/exercises/api/exercises/   # Exercise API (DRF ViewSet)
```

## Comments App Routes (`comments/urls.py`)
```
/comments/api/video-comments/  # Video comment API (DRF ViewSet)
```

## API Endpoints Summary

### Core API
- `POST /core/api/upload-video/` - Upload video file
- `GET /core/api/videos/` - List all videos
- `DELETE /core/api/videos/<uuid>/delete/` - Delete specific video

### Exercises API (DRF)
- `GET /exercises/api/exercises/` - List exercises
- `POST /exercises/api/exercises/` - Create exercise
- `GET /exercises/api/exercises/<id>/` - Get exercise detail
- `PUT /exercises/api/exercises/<id>/` - Update exercise
- `DELETE /exercises/api/exercises/<id>/` - Delete exercise

### Comments API (DRF)
- `GET /comments/api/video-comments/` - List video comments
- `POST /comments/api/video-comments/` - Create video comment
- `GET /comments/api/video-comments/<id>/` - Get comment detail
- `PUT /comments/api/video-comments/<id>/` - Update comment
- `DELETE /comments/api/video-comments/<id>/` - Delete comment

## Frontend Routes (Five Core Surfaces)
1. **Home/Feed**: `/exercises/` - Exercise list page
2. **Exercise Detail**: `/exercises/exercise/<uuid>/` - Individual exercise view
3. **Upload**: `/exercises/create/` - Create exercise form
4. **Login**: `/exercises/login/` - User authentication
5. **Admin**: Django admin interface (not custom route)

## Out-of-Scope Routes (v1)
- `/core/metrics/` - Prometheus metrics
- `/core/logs/` - Log viewing
- `/core/test/` - Test endpoints
- `/core/upload-test/` - Upload testing
- `/core/debug-settings/` - Debug configuration

## Route Dependencies
- **Authentication required**: All API endpoints, create/edit pages
- **Staff only**: Exercise creation, editing, deletion
- **Public**: Exercise viewing, home page
- **Admin only**: Django admin interface

## URL Naming
- **App namespaces**: `core:`, `exercises:`, `comments:`
- **URL names**: Descriptive names for reverse lookups
- **UUIDs**: Used for video assets, exercises, and comments
- **RESTful**: API endpoints follow REST conventions
