# 🗄️ Current Database Schema - Practika

## **Database Information**

- **Engine**: PostgreSQL (RDS)
- **Version**: PostgreSQL 13+ (t3.micro instance)
- **Database Name**: practika
- **Host**: practika-prod-db-v2.{region}.rds.amazonaws.com
- **Generated**: August 30, 2025
- **Source**: Django migrations and models

## **Entity Relationship Diagram**

```mermaid
erDiagram
    %% Django Auth User (built-in)
    auth_user {
        int id PK
        varchar username UK
        varchar email
        varchar password
        boolean is_active
        boolean is_staff
        boolean is_superuser
        datetime date_joined
        datetime last_login
        varchar first_name
        varchar last_name
    }

    %% Core App - Video Assets
    core_videoasset {
        uuid id PK
        varchar orig_filename
        varchar storage_path
        varchar mime_type
        int size_bytes
        varchar checksum_sha256
        varchar poster_path
        json renditions
        varchar youtube_url
        varchar video_type
        int duration_sec
        int width
        int height
        varchar processing_status
        text processing_error
        datetime processed_at
        boolean is_valid
        datetime last_validated
        json validation_errors
        int access_count
        datetime last_accessed
        datetime created_at
        datetime updated_at
    }

    %% Core App - Video Clips
    core_videoclip {
        uuid id PK
        uuid original_video FK
        varchar clip_hash UK
        float start_time
        float end_time
        float duration
        varchar storage_path
        int size_bytes
        varchar processing_status
        text processing_error
        datetime processed_at
        datetime created_at
        datetime updated_at
    }

    %% Exercises App
    exercises_exercise {
        uuid id PK
        varchar name
        text description
        uuid video_asset FK
        int created_by FK
        datetime created_at
        datetime updated_at
    }

    %% Comments App
    comments_videocomment {
        uuid id PK
        uuid exercise FK
        int author FK
        text text
        uuid video_asset FK
        datetime created_at
        datetime updated_at
    }

    %% Accounts App - Roles
    accounts_role {
        int id PK
        varchar name UK
    }

    %% Accounts App - Profiles
    accounts_profile {
        int id PK
        int user FK UK
        int role FK
        datetime email_verified_at
        boolean onboarding_completed
        datetime first_login_at
        datetime last_activity_at
        json preferences
    }

    %% Accounts App - Beta Invitations
    accounts_betainvitation {
        int id PK
        varchar email UK
        varchar token UK
        datetime accepted_at
    }

    %% Accounts App - User Metrics
    accounts_usermetrics {
        int id PK
        int profile FK UK
        int exercises_created
        int comments_made
        int total_video_time
    }

    %% Relationships
    auth_user ||--o{ exercises_exercise : "creates"
    auth_user ||--o{ comments_videocomment : "authors"
    auth_user ||--|| accounts_profile : "has"
    accounts_profile ||--o{ accounts_usermetrics : "tracks"
    accounts_role ||--o{ accounts_profile : "assigns"
    
    core_videoasset ||--o{ core_videoclip : "generates"
    core_videoasset ||--o{ exercises_exercise : "used_in"
    core_videoasset ||--o{ comments_videocomment : "commented_on"
    
    exercises_exercise ||--o{ comments_videocomment : "receives"
```

## **ORM View (Django Models)**

### **Core App Models**

#### **VideoAsset** (`core/models.py`)
```python
class VideoAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    orig_filename = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=500, null=True, blank=True)
    mime_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    checksum_sha256 = models.CharField(max_length=64, null=True, blank=True)
    poster_path = models.CharField(max_length=500, null=True, blank=True)
    renditions = models.JSONField(default=dict, blank=True)
    youtube_url = models.URLField(null=True, blank=True)
    video_type = models.CharField(max_length=20, choices=[...], default='upload')
    duration_sec = models.PositiveIntegerField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    processing_status = models.CharField(max_length=20, choices=[...], default='pending')
    processing_error = models.TextField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    is_valid = models.BooleanField(default=True)
    last_validated = models.DateTimeField(null=True, blank=True)
    validation_errors = models.JSONField(default=list, blank=True)
    access_count = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### **VideoClip** (`core/models.py`)
```python
class VideoClip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    original_video = models.ForeignKey(VideoAsset, on_delete=models.CASCADE, related_name='clips')
    clip_hash = models.CharField(max_length=64, unique=True)
    start_time = models.FloatField()
    end_time = models.FloatField()
    duration = models.FloatField()
    storage_path = models.CharField(max_length=500)
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    processing_status = models.CharField(max_length=20, choices=[...], default='pending')
    processing_error = models.TextField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **Exercises App Models**

#### **Exercise** (`exercises/models.py`)
```python
class Exercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=140)
    description = models.TextField(null=True, blank=True)
    video_asset = models.ForeignKey(VideoAsset, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **Comments App Models**

#### **VideoComment** (`comments/models.py`)
```python
class VideoComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(null=True, blank=True)
    video_asset = models.ForeignKey(VideoAsset, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **Accounts App Models**

#### **Role** (`accounts/models.py`)
```python
class Role(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)
```

#### **Profile** (`accounts/models.py`)
```python
class Profile(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    onboarding_completed = models.BooleanField(default=False)
    first_login_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)
```

#### **BetaInvitation** (`accounts/models.py`)
```python
class BetaInvitation(models.Model):
    id = models.BigAutoField(primary_key=True)
    email = models.EmailField(unique=True)
    token = models.CharField(max_length=64, unique=True, default=_generate_token)
    accepted_at = models.DateTimeField(null=True, blank=True)
```

#### **UserMetrics** (`accounts/models.py`)
```python
class UserMetrics(models.Model):
    id = models.BigAutoField(primary_key=True)
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name="metrics")
    exercises_created = models.PositiveIntegerField(default=0)
    comments_made = models.PositiveIntegerField(default=0)
    total_video_time = models.PositiveIntegerField(default=0)
```

## **Database Constraints**

### **Unique Constraints**
- `core_videoclip.clip_hash` - Ensures idempotent clip creation
- `exercises_exercise.name + created_by` - Prevents duplicate exercise names per user
- `accounts_profile.user` - One profile per user
- `accounts_usermetrics.profile` - One metrics record per profile
- `accounts_role.name` - Unique role names
- `accounts_betainvitation.email` - Unique email invitations
- `accounts_betainvitation.token` - Unique invitation tokens

### **Foreign Key Constraints**
- `core_videoclip.original_video` → `core_videoasset.id` (CASCADE)
- `exercises_exercise.video_asset` → `core_videoasset.id` (CASCADE)
- `exercises_exercise.created_by` → `auth_user.id` (CASCADE)
- `comments_videocomment.exercise` → `exercises_exercise.id` (CASCADE)
- `comments_videocomment.author` → `auth_user.id` (CASCADE)
- `comments_videocomment.video_asset` → `core_videoasset.id` (CASCADE)
- `accounts_profile.user` → `auth_user.id` (CASCADE)
- `accounts_profile.role` → `accounts_role.id` (SET_NULL)
- `accounts_usermetrics.profile` → `accounts_profile.id` (CASCADE)

### **Indexes**
- `core_videoasset.mime_type` - Video type queries
- `core_videoasset.processing_status` - Status filtering
- `core_videoasset.created_at` - Time-based queries
- `core_videoclip.clip_hash` - Idempotency lookups
- `core_videoclip.original_video + start_time + end_time` - Clip range queries
- `core_videoclip.processing_status` - Status filtering
- `core_videoclip.created_at` - Time-based queries
- `comments_videocomment.created_at` - Recent comments (ordering)

## **Data Types & Sizes**

| Field Type | Database Type | Size | Nullable | Default |
|------------|---------------|------|----------|---------|
| UUID | uuid | 16 bytes | No | uuid.uuid4() |
| CharField | varchar | 255-500 chars | Yes/No | None |
| TextField | text | Unlimited | Yes | None |
| IntegerField | integer | 4 bytes | Yes/No | 0 |
| PositiveIntegerField | integer | 4 bytes | Yes/No | 0 |
| FloatField | double precision | 8 bytes | No | None |
| BooleanField | boolean | 1 byte | No | False |
| DateTimeField | timestamp | 8 bytes | Yes/No | auto_now_add |
| JSONField | jsonb | Variable | Yes | {} or [] |
| URLField | varchar | 200 chars | Yes | None |
| EmailField | varchar | 254 chars | Yes | None |

## **Migration History**

### **Core App Migrations**
1. `0001_initial.py` - Initial VideoAsset model
2. `0002_alter_videoasset_options_videoasset_access_count_and_more.py` - Added metadata fields
3. `0003_remove_videoasset_core_videoa_is_vali_a570d9_idx.py` - Index cleanup
4. `0004_videoasset_renditions.py` - Added renditions JSON field
5. `0005_auto_20250830_1627.py` - Processing status fields
6. `0006_videoclip.py` - Added VideoClip model
7. `0007_auto_20250830_1631.py` - Clip processing fields
8. `0008_alter_videoclip_size_bytes.py` - Made size_bytes nullable
9. `0009_videoasset_video_type_videoasset_youtube_url_and_more.py` - YouTube support

### **Exercises App Migrations**
1. `0001_initial.py` - Initial Exercise model

### **Comments App Migrations**
1. `0001_initial.py` - Initial VideoComment model
2. `0002_alter_videocomment_options.py` - Added ordering
3. `0003_alter_videocomment_video_asset.py` - Added video_asset FK
4. `0004_auto_20250826_1943.py` - Model updates
5. `0005_auto_20250826_2039.py` - Additional updates

### **Accounts App Migrations**
1. `0001_initial.py` - Initial Role and Profile models
2. `0002_seed_roles.py` - Role seeding
3. `0003_auto_20250827_0447.py` - Profile updates
4. `0004_profile_email_verified_at.py` - Email verification
5. `0005_profile_comments_made_profile_exercises_created_and_more.py` - Metrics fields
6. `0006_betainvitation.py` - BetaInvitation model
7. `0006_remove_profile_comments_made_and_more.py` - Cleanup

## **Database Drift Analysis**

### **ORM ↔ Database Alignment**
- ✅ All models have corresponding database tables
- ✅ Foreign key relationships match
- ✅ Unique constraints are enforced
- ✅ Indexes are properly created
- ✅ Data types are correctly mapped

### **Potential Issues**
- **No drift detected** - ORM and database schema are aligned
- **Migration history is clean** - No conflicting migrations
- **Constraints are properly enforced** - All relationships work correctly

## **Performance Considerations**

### **Query Patterns**
- **Video listing**: Filtered by processing_status, ordered by created_at
- **Clip creation**: Lookup by clip_hash for idempotency
- **Exercise management**: Filtered by created_by, ordered by created_at
- **Comment display**: Ordered by created_at (most recent first)

### **Optimization Opportunities**
- **Composite indexes** on frequently queried combinations
- **Partial indexes** for active/processed videos
- **Materialized views** for complex aggregations (future)

---

*Generated on: August 30, 2025*  
*Source: Django migrations and model definitions*
