# Practika Models Documentation

## Core Models

### VideoAsset (`core/models.py` - 310 lines)
**Purpose**: Central video storage and management model

**Fields**:
- `id` (UUID, PK) - Unique identifier
- `orig_filename` (CharField) - Original uploaded filename
- `storage_path` (CharField) - Path to stored video file
- `mime_type` (CharField) - Video MIME type
- `size_bytes` (PositiveIntegerField) - File size in bytes
- `checksum_sha256` (CharField) - SHA256 integrity check
- `duration_sec` (PositiveIntegerField) - Video duration
- `width` (PositiveIntegerField) - Video width in pixels
- `height` (PositiveIntegerField) - Video height in pixels
- `poster_path` (CharField) - Path to poster image
- `processing_status` (CharField) - pending/processing/completed/failed
- `processing_error` (TextField) - Error message if failed
- `created_at` (DateTimeField) - Creation timestamp
- `updated_at` (DateTimeField) - Last update timestamp
- `processed_at` (DateTimeField) - Processing completion time
- `access_count` (PositiveIntegerField) - Number of accesses
- `last_accessed` (DateTimeField) - Last access time
- `is_valid` (BooleanField) - Integrity validation status
- `validation_errors` (JSONField) - List of validation errors
- `last_validated` (DateTimeField) - Last validation time

**Methods**:
- `clean()` - Custom validation
- `save()` - Override with validation and logging
- `_calculate_checksum()` - SHA256 calculation
- `_post_save_operations()` - Post-save processing
- `validate_integrity()` - File integrity validation
- `mark_accessed()` - Track access
- `get_public_url()` - Get public URL via storage service
- `get_file_info()` - Comprehensive file information
- `delete()` - Clean up physical files
- `get_storage_stats()` - Storage statistics

**Meta**:
- Table: `core_videoasset`
- Indexes: mime_type, processing_status, created_at, is_valid

## Exercise Models

### Exercise (`exercises/models.py` - 22 lines)
**Purpose**: Exercise definition and management

**Fields**:
- `id` (UUID, PK) - Unique identifier
- `name` (CharField, 140 chars) - Exercise name
- `description` (TextField) - Exercise description
- `video_asset` (ForeignKey to VideoAsset) - Associated video
- `created_by` (ForeignKey to User) - Creator
- `created_at` (DateTimeField) - Creation timestamp
- `updated_at` (DateTimeField) - Last update timestamp

**Meta**:
- Table: `exercises_exercise`
- Unique constraint: name + created_by

## Comment Models

### VideoComment (`comments/models.py` - 23 lines)
**Purpose**: Video-based comment system

**Fields**:
- `id` (UUID, PK) - Unique identifier
- `exercise` (ForeignKey to Exercise) - Associated exercise
- `author` (ForeignKey to User) - Comment author
- `text` (TextField) - Optional text comment
- `video_asset` (ForeignKey to VideoAsset) - Video reply
- `created_at` (DateTimeField) - Creation timestamp
- `updated_at` (DateTimeField) - Last update timestamp

**Meta**:
- Table: `comments_videocomment`
- Ordering: Most recent first (-created_at)

## User Model
**Purpose**: Django's built-in User model for authentication

**Usage**: Referenced by Exercise.created_by and VideoComment.author

## Model Relationships

```
User (Django built-in)
├── Exercise.created_by (1:many)
└── VideoComment.author (1:many)

VideoAsset (core)
├── Exercise.video_asset (1:1)
└── VideoComment.video_asset (1:1)

Exercise (exercises)
└── VideoComment.exercise (1:many)
```

## Database Schema

### Core Tables
- `core_videoasset` - Video storage and metadata

### Exercise Tables  
- `exercises_exercise` - Exercise definitions

### Comment Tables
- `comments_videocomment` - Video comments

### Django Tables
- `auth_user` - User accounts
- `django_session` - User sessions
- `django_migrations` - Migration history

## Model Validation

### VideoAsset Validation
- File size > 0
- MIME type in allowed list
- SHA256 checksum format (64 chars)
- File existence and accessibility
- Integrity checks on save

### Exercise Validation
- Unique name per creator
- Required video_asset reference

### VideoComment Validation
- Required exercise and author references
- Video asset required for video replies

## Import-Time Dependencies
**Current Issues**:
- VideoAsset model imports `core.services.storage` at import time
- Heavy validation logic in model methods
- File system operations during model definition

**Refactor Target**: Move heavy operations to service layer, avoid import-time side effects

## Storage Abstraction
**Current**: Mixed local file system and S3 storage
**Target**: Single storage service interface with local/S3 backends
**Service**: `core.services.storage.VideoStorageService`

## Model Usage Patterns

### Video Upload Flow
1. Create VideoAsset with basic metadata
2. Process video (extract duration, dimensions)
3. Update processing_status to 'completed'
4. Associate with Exercise or VideoComment

### Exercise Creation Flow
1. Upload video via VideoAsset
2. Create Exercise with video_asset reference
3. Set created_by to current user

### Comment Creation Flow
1. Upload video reply via VideoAsset
2. Create VideoComment with video_asset reference
3. Link to Exercise and set author
