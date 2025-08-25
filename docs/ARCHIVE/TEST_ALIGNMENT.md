# Practika Test Alignment Plan

## Mission
Keep tests only for: auth; create exercise; upload video; post video reply; list feed; exercise detail; admin remove; health 200. Remove or skip tests tied to out-of-scope features.

## Current Test Structure

### Test Files
```
tests/
├── conftest.py                    # Test configuration
├── factories.py                   # Test data factories
├── test_a11y_icons.py            # Accessibility tests
├── test_api_comments.py           # Comment API tests
├── test_api_exercises.py          # Exercise API tests
├── test_media_validation.py       # Media validation tests
├── test_mobile_compatibility.py   # Mobile compatibility tests
├── test_models.py                 # Model tests
├── test_permissions.py            # Permission tests
├── test_request_id_middleware.py  # Middleware tests
└── test_security.py               # Security tests
```

### Test Coverage Analysis

#### KEEP Tests (Core v1 Functionality)

##### 1. Authentication Tests
**File**: `test_permissions.py`
**Purpose**: Test user authentication and permissions
**Scope**: KEEP - Essential for v1

**Test Cases to Keep**:
- User login/logout
- Staff permissions for exercise creation
- User permissions for viewing exercises
- Authentication required for API endpoints

**Test Cases to Remove**:
- Complex role-based permissions
- Advanced security features
- Rate limiting tests

##### 2. Exercise Creation Tests
**File**: `test_api_exercises.py`
**Purpose**: Test exercise CRUD operations
**Scope**: KEEP - Core v1 functionality

**Test Cases to Keep**:
- Create exercise (staff only)
- View exercise list
- View exercise detail
- Update exercise (staff only)
- Delete exercise (staff only)

**Test Cases to Remove**:
- Complex filtering
- Advanced search
- Bulk operations

##### 3. Video Upload Tests
**File**: `test_media_validation.py`
**Purpose**: Test video upload functionality
**Scope**: KEEP - Core v1 functionality

**Test Cases to Keep**:
- Video file upload
- File type validation
- File size validation
- Basic video processing

**Test Cases to Remove**:
- Complex video processing
- Advanced validation
- Performance monitoring

##### 4. Video Comment Tests
**File**: `test_api_comments.py`
**Purpose**: Test video comment system
**Scope**: KEEP - Core v1 functionality

**Test Cases to Keep**:
- Create video comment
- List comments for exercise
- Delete comment (author only)
- Comment permissions

**Test Cases to Remove**:
- Advanced comment features
- Comment moderation
- Complex reply chains

##### 5. Feed/List Tests
**File**: `test_api_exercises.py`
**Purpose**: Test exercise listing
**Scope**: KEEP - Core v1 functionality

**Test Cases to Keep**:
- List all exercises
- Pagination (basic)
- Exercise ordering
- Public access

**Test Cases to Remove**:
- Advanced filtering
- Search functionality
- Complex sorting

##### 6. Exercise Detail Tests
**File**: `test_api_exercises.py`
**Purpose**: Test individual exercise view
**Scope**: KEEP - Core v1 functionality

**Test Cases to Keep**:
- View exercise details
- Video playback
- Comment display
- Basic metadata

**Test Cases to Remove**:
- Advanced video features
- Complex metadata
- Performance metrics

##### 7. Admin Tests
**File**: `test_permissions.py`
**Purpose**: Test admin functionality
**Scope**: KEEP - Core v1 functionality

**Test Cases to Keep**:
- Admin access to exercises
- Admin user management
- Basic CRUD operations
- Permission checks

**Test Cases to Remove**:
- Advanced admin features
- Complex workflows
- Analytics dashboard

##### 8. Health Check Tests
**File**: New test file needed
**Purpose**: Test health endpoint
**Scope**: KEEP - Essential for v1

**Test Cases to Add**:
- Health endpoint returns 200
- No database dependency
- Fast response time
- Basic status check

#### REMOVE Tests (Out-of-Scope Features)

##### 1. Accessibility Tests
**File**: `test_a11y_icons.py`
**Purpose**: Test icon accessibility
**Scope**: REMOVE - Out-of-scope for v1

**Reason**: Complex icon system being removed
**Replacement**: Basic accessibility testing in core templates

##### 2. Mobile Compatibility Tests
**File**: `test_mobile_compatibility.py`
**Purpose**: Test mobile optimization
**Scope**: REMOVE - Out-of-scope for v1

**Reason**: Mobile optimization features being removed
**Replacement**: Basic responsive design testing

##### 3. Middleware Tests
**File**: `test_request_id_middleware.py`
**Purpose**: Test custom middleware
**Scope**: REMOVE - Out-of-scope for v1

**Reason**: Custom middleware being removed
**Replacement**: Test Django built-in middleware only

##### 4. Advanced Security Tests
**File**: `test_security.py`
**Purpose**: Test advanced security features
**Scope**: REMOVE - Out-of-scope for v1

**Reason**: Complex security features being removed
**Replacement**: Basic security testing (CSRF, auth)

##### 5. Media Validation Tests (Complex)
**File**: `test_media_validation.py`
**Purpose**: Test advanced media validation
**Scope**: MODIFY - Keep basic, remove complex

**Keep**: Basic file validation
**Remove**: Complex processing, performance monitoring

## Test Alignment Strategy

### Phase 1: Remove Out-of-Scope Tests
1. Delete `test_a11y_icons.py`
2. Delete `test_mobile_compatibility.py`
3. Delete `test_request_id_middleware.py`
4. Modify `test_security.py` (remove complex features)

### Phase 2: Simplify Complex Tests
1. Simplify `test_media_validation.py`
2. Simplify `test_api_exercises.py`
3. Simplify `test_api_comments.py`
4. Simplify `test_permissions.py`

### Phase 3: Add Missing Tests
1. Create health check tests
2. Add basic CRUD tests
3. Add simple permission tests
4. Add basic validation tests

### Phase 4: Test Suite Validation
1. Run all tests
2. Verify core functionality
3. Check test coverage
4. Validate test performance

## Test File Modifications

### 1. `test_media_validation.py` - SIMPLIFY
**Before**: Complex validation, performance monitoring
**After**: Basic file validation only

```python
# KEEP: Basic validation
def test_video_file_upload():
    """Test basic video file upload"""
    pass

def test_file_type_validation():
    """Test file type validation"""
    pass

def test_file_size_validation():
    """Test file size validation"""
    pass

# REMOVE: Complex features
# def test_video_processing_performance():
# def test_advanced_validation():
# def test_performance_monitoring():
```

### 2. `test_api_exercises.py` - SIMPLIFY
**Before**: Advanced filtering, search, bulk operations
**After**: Basic CRUD operations only

```python
# KEEP: Core CRUD
def test_create_exercise():
    """Test exercise creation"""
    pass

def test_list_exercises():
    """Test exercise listing"""
    pass

def test_exercise_detail():
    """Test exercise detail view"""
    pass

def test_update_exercise():
    """Test exercise update"""
    pass

def test_delete_exercise():
    """Test exercise deletion"""
    pass

# REMOVE: Advanced features
# def test_advanced_filtering():
# def test_search_functionality():
# def test_bulk_operations():
```

### 3. `test_api_comments.py` - SIMPLIFY
**Before**: Advanced comment features, moderation
**After**: Basic comment functionality only

```python
# KEEP: Core comment functionality
def test_create_video_comment():
    """Test video comment creation"""
    pass

def test_list_comments():
    """Test comment listing"""
    pass

def test_delete_comment():
    """Test comment deletion"""
    pass

def test_comment_permissions():
    """Test comment permissions"""
    pass

# REMOVE: Advanced features
# def test_comment_moderation():
# def test_advanced_reply_chains():
# def test_comment_analytics():
```

### 4. `test_permissions.py` - SIMPLIFY
**Before**: Complex role-based permissions
**After**: Basic authentication and staff permissions

```python
# KEEP: Basic permissions
def test_staff_can_create_exercise():
    """Test staff can create exercises"""
    pass

def test_user_can_view_exercises():
    """Test users can view exercises"""
    pass

def test_non_staff_cannot_create():
    """Test non-staff cannot create"""
    pass

def test_authentication_required():
    """Test authentication required"""
    pass

# REMOVE: Complex permissions
# def test_role_based_access():
# def test_advanced_permissions():
# def test_permission_hierarchy():
```

### 5. `test_security.py` - SIMPLIFY
**Before**: Advanced security features, rate limiting
**After**: Basic security testing only

```python
# KEEP: Basic security
def test_csrf_protection():
    """Test CSRF protection"""
    pass

def test_authentication_required():
    """Test authentication required"""
    pass

def test_session_security():
    """Test session security"""
    pass

# REMOVE: Advanced security
# def test_rate_limiting():
# def test_account_lockout():
# def test_advanced_security_headers():
```

## New Test Files

### 1. `test_health.py` - NEW
**Purpose**: Test health check endpoint
**Scope**: Essential for v1

```python
import pytest
from django.test import Client
from django.urls import reverse

class TestHealthCheck:
    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200"""
        client = Client()
        response = client.get('/core/health/')
        assert response.status_code == 200
    
    def test_health_endpoint_fast_response(self):
        """Health endpoint should respond quickly"""
        client = Client()
        response = client.get('/core/health/')
        # Should respond in under 100ms
        assert response.status_code == 200
    
    def test_health_endpoint_no_database(self):
        """Health endpoint should not require database"""
        # Test with database connection issues
        pass
```

### 2. `test_core_functionality.py` - NEW
**Purpose**: Test core app functionality
**Scope**: Essential for v1

```python
import pytest
from django.test import Client
from core.models import VideoAsset

class TestCoreFunctionality:
    def test_video_upload(self):
        """Test video upload functionality"""
        pass
    
    def test_video_listing(self):
        """Test video listing functionality"""
        pass
    
    def test_video_deletion(self):
        """Test video deletion functionality"""
        pass
```

## Test Configuration

### `conftest.py` - SIMPLIFY
**Before**: Complex test configuration
**After**: Basic test setup only

```python
import pytest
from django.conf import settings

@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Enable database access for all tests"""
    pass

@pytest.fixture
def simple_user(db):
    """Create a simple user for testing"""
    from django.contrib.auth.models import User
    return User.objects.create_user(username='testuser', password='testpass')

@pytest.fixture
def staff_user(db):
    """Create a staff user for testing"""
    from django.contrib.auth.models import User
    return User.objects.create_user(
        username='staffuser', 
        password='testpass',
        is_staff=True
    )
```

### `factories.py` - SIMPLIFY
**Before**: Complex test data factories
**After**: Basic test data only

```python
import factory
from django.contrib.auth.models import User
from core.models import VideoAsset
from exercises.models import Exercise
from comments.models import VideoComment

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
    
    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda obj: f'{obj.username}@example.com')

class VideoAssetFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = VideoAsset
    
    orig_filename = 'test_video.mp4'
    storage_path = '/tmp/test_video.mp4'
    mime_type = 'video/mp4'
    size_bytes = 1024

class ExerciseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Exercise
    
    name = factory.Sequence(lambda n: f'Exercise {n}')
    description = factory.Faker('text')
    video_asset = factory.SubFactory(VideoAssetFactory)
    created_by = factory.SubFactory(UserFactory)

class VideoCommentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = VideoComment
    
    exercise = factory.SubFactory(ExerciseFactory)
    author = factory.SubFactory(UserFactory)
    video_asset = factory.SubFactory(VideoAssetFactory)
    text = factory.Faker('text')
```

## Test Execution

### Test Commands
```bash
# Run all tests
pytest

# Run specific test files
pytest tests/test_api_exercises.py
pytest tests/test_api_comments.py
pytest tests/test_permissions.py

# Run with coverage
pytest --cov=.

# Run fast tests only
pytest -x --tb=short
```

### Test Performance Targets
- **Total test time**: Under 30 seconds
- **Individual test time**: Under 1 second
- **Test count**: 20-30 tests total
- **Coverage**: 80%+ for core functionality

## Expected Outcomes

### Test Simplification
- **Test files**: 11 → 6 files (45% reduction)
- **Test cases**: Complex → Simple
- **Test time**: Faster execution
- **Maintenance**: Easier to maintain

### Test Coverage
- **Core functionality**: 100% coverage
- **API endpoints**: 100% coverage
- **Permissions**: 100% coverage
- **Basic validation**: 100% coverage

### Test Quality
- **Fast execution**: All tests under 1 second
- **Clear purpose**: Each test has clear intent
- **Easy debugging**: Simple test failures
- **Maintainable**: Easy to update and modify

## Success Criteria

### Functional Coverage
- Authentication works correctly
- Exercise CRUD operations work
- Video upload works correctly
- Comments work properly
- Admin functionality works

### Non-Functional Coverage
- Health endpoint responds quickly
- No database dependency for health
- Basic security features work
- Permissions are enforced

### Scope Compliance
- No tests for out-of-scope features
- No complex test scenarios
- No performance monitoring tests
- No advanced feature tests
