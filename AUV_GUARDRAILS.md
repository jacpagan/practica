# 🛡️ Atomic Units of Value (AUV) Guardrails

## **AUV Inventory & Validation**

### **Required AUVs vs Current Implementation**

| AUV | Required | Current Status | Evidence | Gap |
|-----|----------|----------------|----------|-----|
| **MediaAsset** | ✅ Yes | ✅ `core_videoasset` | `CURRENT_ERD.md` lines 25-75 | None |
| **Clip** | ✅ Yes | ✅ `core_videoclip` | `CURRENT_ERD.md` lines 150-200 | None |
| **Exercise** | ✅ Yes | ✅ `exercises_exercise` | `CURRENT_ERD.md` lines 100-120 | None |
| **Submission** | ❌ No | ❌ Not implemented | No evidence | Missing |
| **Comparison** | ❌ No | ❌ Not implemented | No evidence | Missing |
| **Comment/CommentVideo** | ✅ Yes | ✅ `comments_videocomment` | `CURRENT_ERD.md` lines 125-140 | None |
| **Stack (exercise×student)** | ✅ Yes | ✅ `exercises_exercise` + `auth_user` | `CURRENT_ERD.md` lines 100-120 | None |
| **Label/Tag** | ❌ No | ❌ Not implemented | No evidence | Missing |
| **HelpfulVote** | ❌ No | ❌ Not implemented | No evidence | Missing |

### **AUV Schema Validation**

#### **1. MediaAsset (core_videoasset)**
```sql
-- ✅ EXISTS: Complete implementation
CREATE TABLE core_videoasset (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    orig_filename varchar(255) NOT NULL,
    storage_path varchar(500),
    mime_type varchar(100) NOT NULL,
    size_bytes integer,
    checksum_sha256 varchar(64),
    poster_path varchar(500),
    renditions jsonb DEFAULT '{}',
    youtube_url varchar(200),
    video_type varchar(20) DEFAULT 'upload',
    duration_sec integer,
    width integer,
    height integer,
    processing_status varchar(20) DEFAULT 'pending',
    processing_error text,
    processed_at timestamp,
    is_valid boolean DEFAULT true,
    last_validated timestamp,
    validation_errors jsonb DEFAULT '[]',
    access_count integer DEFAULT 0,
    last_accessed timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
```

**Invariants:**
- `id` is UUID primary key
- `mime_type` must be valid video MIME type
- `size_bytes` must be > 0 if present
- `checksum_sha256` must be 64 characters if present
- `video_type` must be in ['upload', 'recorded', 'youtube']

**Indexes:**
- `idx_core_videoasset_mime_type` on `mime_type`
- `idx_core_videoasset_processing_status` on `processing_status`
- `idx_core_videoasset_created_at` on `created_at`

**API Endpoints:**
- `POST /core/api/upload-video/` (`core.views.upload_video`)
- `GET /core/api/videos/` (`core.views.list_videos`)
- `DELETE /core/api/videos/<uuid:video_id>/delete/` (`core.views.delete_video`)

#### **2. Clip (core_videoclip)**
```sql
-- ✅ EXISTS: Complete implementation
CREATE TABLE core_videoclip (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_video uuid REFERENCES core_videoasset(id) ON DELETE CASCADE,
    clip_hash varchar(64) UNIQUE NOT NULL,
    start_time double precision NOT NULL,
    end_time double precision NOT NULL,
    duration double precision NOT NULL,
    storage_path varchar(500) NOT NULL,
    size_bytes integer,
    processing_status varchar(20) DEFAULT 'pending',
    processing_error text,
    processed_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
```

**Invariants:**
- `id` is UUID primary key
- `original_video` must reference valid VideoAsset
- `clip_hash` must be unique (idempotency)
- `start_time` must be >= 0
- `end_time` must be > `start_time`
- `duration` must equal `end_time - start_time`

**Indexes:**
- `idx_core_videoclip_clip_hash` on `clip_hash`
- `idx_core_videoclip_original_video_start_end` on `original_video, start_time, end_time`
- `idx_core_videoclip_processing_status` on `processing_status`
- `idx_core_videoclip_created_at` on `created_at`

**API Endpoints:**
- `POST /core/api/create-clip/` (`core.views.create_clip`)

#### **3. Exercise (exercises_exercise)**
```sql
-- ✅ EXISTS: Complete implementation
CREATE TABLE exercises_exercise (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(140) NOT NULL,
    description text,
    video_asset uuid REFERENCES core_videoasset(id) ON DELETE CASCADE,
    created_by integer REFERENCES auth_user(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(name, created_by)
);
```

**Invariants:**
- `id` is UUID primary key
- `video_asset` must reference valid VideoAsset
- `created_by` must reference valid User
- `name` + `created_by` must be unique per user

**Indexes:**
- `idx_exercises_exercise_created_by` on `created_by`
- `idx_exercises_exercise_created_at` on `created_at`

**API Endpoints:**
- `GET /exercises/api/exercises/` (`ExerciseViewSet.list`)
- `POST /exercises/api/exercises/` (`ExerciseViewSet.create`)
- `GET /exercises/api/exercises/<uuid:pk>/` (`ExerciseViewSet.retrieve`)
- `PUT /exercises/api/exercises/<uuid:pk>/` (`ExerciseViewSet.update`)
- `DELETE /exercises/api/exercises/<uuid:pk>/` (`ExerciseViewSet.destroy`)

#### **4. Comment/CommentVideo (comments_videocomment)**
```sql
-- ✅ EXISTS: Complete implementation
CREATE TABLE comments_videocomment (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise uuid REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    author integer REFERENCES auth_user(id) ON DELETE CASCADE,
    text text,
    video_asset uuid REFERENCES core_videoasset(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
```

**Invariants:**
- `id` is UUID primary key
- `exercise` must reference valid Exercise
- `author` must reference valid User
- `video_asset` must reference valid VideoAsset
- Either `text` or `video_asset` must be present

**Indexes:**
- `idx_comments_videocomment_exercise` on `exercise`
- `idx_comments_videocomment_author` on `author`
- `idx_comments_videocomment_created_at` on `created_at`

**API Endpoints:**
- `GET /comments/video-comments/` (`VideoCommentViewSet.list`)
- `POST /comments/video-comments/` (`VideoCommentViewSet.create`)
- `GET /comments/video-comments/<uuid:pk>/` (`VideoCommentViewSet.retrieve`)
- `PUT /comments/video-comments/<uuid:pk>/` (`VideoCommentViewSet.update`)
- `DELETE /comments/video-comments/<uuid:pk>/` (`VideoCommentViewSet.destroy`)

#### **5. Stack (exercise×student)**
```sql
-- ✅ EXISTS: Implicit in exercises_exercise.created_by
-- Each exercise is associated with a student via created_by field
-- Stack = exercises_exercise WHERE created_by = student_id
```

**Invariants:**
- Every exercise must have a `created_by` user
- User can have multiple exercises (stack)
- Exercise belongs to exactly one user

**API Endpoints:**
- `GET /exercises/api/exercises/` (filtered by user)
- `GET /exercises/` (user's exercise list)

### **Missing AUVs**

#### **6. Submission**
```sql
-- ❌ MISSING: Not implemented
-- Should track student submissions of exercises
CREATE TABLE submissions_submission (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    student integer REFERENCES auth_user(id) ON DELETE CASCADE,
    exercise uuid REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    video_asset uuid REFERENCES core_videoasset(id) ON DELETE CASCADE,
    submitted_at timestamp DEFAULT now(),
    status varchar(20) DEFAULT 'submitted',
    UNIQUE(student, exercise)
);
```

#### **7. Comparison**
```sql
-- ❌ MISSING: Not implemented
-- Should track comparison sessions between original and feedback
CREATE TABLE comparisons_comparison (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    student integer REFERENCES auth_user(id) ON DELETE CASCADE,
    exercise uuid REFERENCES exercises_exercise(id) ON DELETE CASCADE,
    original_video uuid REFERENCES core_videoasset(id) ON DELETE CASCADE,
    feedback_video uuid REFERENCES core_videoasset(id) ON DELETE CASCADE,
    compared_at timestamp DEFAULT now(),
    duration_seconds integer
);
```

#### **8. Label/Tag**
```sql
-- ❌ MISSING: Not implemented
-- Should allow tagging of exercises and videos
CREATE TABLE tags_tag (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) UNIQUE NOT NULL,
    created_at timestamp DEFAULT now()
);

CREATE TABLE content_tags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type varchar(50) NOT NULL,
    content_id uuid NOT NULL,
    tag_id uuid REFERENCES tags_tag(id) ON DELETE CASCADE,
    created_at timestamp DEFAULT now(),
    UNIQUE(content_type, content_id, tag_id)
);
```

#### **9. HelpfulVote**
```sql
-- ❌ MISSING: Not implemented
-- Should allow voting on helpfulness of comments
CREATE TABLE votes_helpfulvote (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    voter integer REFERENCES auth_user(id) ON DELETE CASCADE,
    comment uuid REFERENCES comments_videocomment(id) ON DELETE CASCADE,
    is_helpful boolean NOT NULL,
    voted_at timestamp DEFAULT now(),
    UNIQUE(voter, comment)
);
```

## **AUV Protection Guardrails**

### **Critical Invariants (Never Break)**

#### **Data Integrity**
1. **VideoAsset Integrity**: `checksum_sha256` must match actual file content
2. **Clip Idempotency**: `clip_hash` must be unique for identical time ranges
3. **Exercise Ownership**: `created_by` must reference valid user
4. **Comment Association**: Comments must reference valid exercise and author
5. **Stack Consistency**: User's exercise stack must be consistent

#### **Business Rules**
1. **Video Processing**: All videos must have valid MIME types
2. **Time Constraints**: Clip end_time must be > start_time
3. **User Permissions**: Users can only access their own content
4. **Content Lifecycle**: Deleted content must cascade properly
5. **Audit Trail**: All AUV changes must be timestamped

### **API Protection**

#### **Endpoints That Touch AUVs**
| AUV | Create | Read | Update | Delete | Evidence |
|-----|--------|------|--------|--------|----------|
| **VideoAsset** | `/core/api/upload-video/` | `/core/api/videos/` | None | `/core/api/videos/<id>/delete/` | `ENDPOINTS.md` lines 15-20 |
| **Clip** | `/core/api/create-clip/` | None | None | None | `ENDPOINTS.md` line 20 |
| **Exercise** | `/exercises/api/exercises/` | `/exercises/api/exercises/` | `/exercises/api/exercises/<id>/` | `/exercises/api/exercises/<id>/` | `ENDPOINTS.md` lines 25-35 |
| **Comment** | `/comments/video-comments/` | `/comments/video-comments/` | `/comments/video-comments/<id>/` | `/comments/video-comments/<id>/` | `ENDPOINTS.md` lines 40-50 |

#### **Required Authentication**
- All AUV endpoints require authentication (`ENDPOINTS.md` lines 230-240)
- Session-based auth with CSRF protection (`SECURITY_POSTURE.md` lines 50-60)
- Rate limiting: 1000/hour for authenticated users (`ENDPOINTS.md` lines 250-260)

### **Infrastructure Protection**

#### **Database Constraints**
```sql
-- Foreign Key Constraints (CASCADE on delete)
ALTER TABLE core_videoclip ADD CONSTRAINT fk_clip_video 
    FOREIGN KEY (original_video) REFERENCES core_videoasset(id) ON DELETE CASCADE;

ALTER TABLE exercises_exercise ADD CONSTRAINT fk_exercise_video 
    FOREIGN KEY (video_asset) REFERENCES core_videoasset(id) ON DELETE CASCADE;

ALTER TABLE exercises_exercise ADD CONSTRAINT fk_exercise_user 
    FOREIGN KEY (created_by) REFERENCES auth_user(id) ON DELETE CASCADE;

ALTER TABLE comments_videocomment ADD CONSTRAINT fk_comment_exercise 
    FOREIGN KEY (exercise) REFERENCES exercises_exercise(id) ON DELETE CASCADE;

ALTER TABLE comments_videocomment ADD CONSTRAINT fk_comment_user 
    FOREIGN KEY (author) REFERENCES auth_user(id) ON DELETE CASCADE;

ALTER TABLE comments_videocomment ADD CONSTRAINT fk_comment_video 
    FOREIGN KEY (video_asset) REFERENCES core_videoasset(id) ON DELETE CASCADE;
```

#### **S3 Protection**
- Private bucket access only (`SECURITY_POSTURE.md` lines 100-120)
- Signed URLs for video access (`core/models.py` lines 100-120)
- No public read access (`aws-deployment.yml` lines 220-240)

#### **Backup Protection**
- RDS automated backups: 7-day retention (`aws-deployment.yml` line 260)
- S3 versioning: Not enabled (gap) (`SECURITY_POSTURE.md` lines 100-120)

### **Code Threats to AUVs**

#### **High Risk (Delete/Gate)**
| Threat | Location | Risk | Evidence | Recommendation |
|--------|----------|------|----------|----------------|
| **Hard-coded file limits** | `settings.py` line 270 | Data loss | `DRIFT_AND_BLOAT.md` lines 50-55 | Move to env vars |
| **Basic error handling** | `core/views.py` | Data corruption | `DRIFT_AND_BLOAT.md` lines 40-45 | Add comprehensive error handling |
| **No validation middleware** | Missing | Security breach | `SECURITY_POSTURE.md` lines 200-220 | Add input validation |

#### **Medium Risk (Monitor)**
| Threat | Location | Risk | Evidence | Recommendation |
|--------|----------|------|----------|----------------|
| **N+1 queries** | `exercises/views.py` | Performance | `DRIFT_AND_BLOAT.md` lines 60-65 | Add select_related |
| **Missing indexes** | Database | Performance | `DRIFT_AND_BLOAT.md` lines 60-65 | Add composite indexes |
| **No connection pooling** | `settings.py` | Reliability | `DRIFT_AND_BLOAT.md` lines 60-65 | Add pooling |

#### **Low Risk (Document)**
| Threat | Location | Risk | Evidence | Recommendation |
|--------|----------|------|----------|----------------|
| **Unused dependencies** | `requirements.txt` | Technical debt | `DRIFT_AND_BLOAT.md` lines 10-15 | Remove unused packages |
| **Dead code files** | Multiple | Maintenance | `DRIFT_AND_BLOAT.md` lines 15-20 | Delete dead files |
| **Duplicate URLs** | `urls.py` | Confusion | `DRIFT_AND_BLOAT.md` lines 30-35 | Consolidate patterns |

### **AUV Testing Requirements**

#### **Unit Tests Required**
```python
# VideoAsset tests
def test_video_asset_creation_with_valid_mime_type()
def test_video_asset_checksum_validation()
def test_video_asset_processing_status_transitions()

# Clip tests
def test_clip_idempotency_same_time_range()
def test_clip_duration_calculation()
def test_clip_hash_uniqueness()

# Exercise tests
def test_exercise_user_ownership()
def test_exercise_name_uniqueness_per_user()
def test_exercise_video_asset_relationship()

# Comment tests
def test_comment_exercise_association()
def test_comment_author_association()
def test_comment_video_asset_relationship()
```

#### **Integration Tests Required**
```python
# AUV workflow tests
def test_upload_reply_compare_workflow()
def test_video_clip_creation_from_asset()
def test_exercise_comment_association()
def test_user_exercise_stack_consistency()

# Data integrity tests
def test_cascade_deletion_on_video_asset()
def test_foreign_key_constraint_enforcement()
def test_unique_constraint_enforcement()
```

### **Monitoring Requirements**

#### **AUV Health Metrics**
| Metric | Threshold | Alert | Evidence |
|--------|-----------|-------|----------|
| **Video processing failures** | > 5% | High | `OBSERVABILITY.md` lines 100-120 |
| **Clip creation failures** | > 2% | Medium | `OBSERVABILITY.md` lines 100-120 |
| **Comment creation failures** | > 1% | Medium | `OBSERVABILITY.md` lines 100-120 |
| **Database constraint violations** | > 0 | Critical | `OBSERVABILITY.md` lines 100-120 |

#### **AUV Performance Metrics**
| Metric | Target | Current | Evidence |
|--------|--------|---------|----------|
| **Video upload time** | < 5s | Unknown | `MVP_GAP_REPORT.md` line 30 |
| **Clip creation time** | < 1s | Unknown | `MVP_GAP_REPORT.md` line 35 |
| **Comment response time** | < 100ms | Unknown | `MVP_GAP_REPORT.md` line 40 |
| **Exercise list load time** | < 500ms | Unknown | `MVP_GAP_REPORT.md` line 45 |

---

*Generated on: August 30, 2025*  
*Evidence-based AUV protection analysis*
