from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    """Extended user profile."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.display_name or self.user.username
class Exercise(models.Model):
    """A named exercise in the library."""
    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
class Tag(models.Model):
    """A freeform label for organizing sessions."""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Session(models.Model):
    """A private library video uploaded by a user."""
    STATUS_UPLOADED = 'uploaded'
    STATUS_PROCESSING = 'processing'
    STATUS_READY = 'ready'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_UPLOADED, 'Uploaded'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_READY, 'Ready'),
        (STATUS_FAILED, 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions', null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    reference_title = models.CharField(max_length=200, blank=True)
    reference_url = models.URLField(blank=True)
    video_file = models.FileField(upload_to='sessions/')
    processing_status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_UPLOADED)
    processing_error = models.TextField(blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='sessions')
    duration_seconds = models.IntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return self.title


class SessionAsset(models.Model):
    """Derived playback/scrubbing assets for a session."""

    TYPE_PROXY_MP4 = 'proxy_mp4'
    TYPE_HLS_MASTER = 'hls_master'
    TYPE_THUMB_SPRITE = 'thumb_sprite'
    TYPE_THUMB_VTT = 'thumb_vtt'
    TYPE_CHOICES = [
        (TYPE_PROXY_MP4, 'Proxy MP4'),
        (TYPE_HLS_MASTER, 'HLS Master'),
        (TYPE_THUMB_SPRITE, 'Thumbnail Sprite'),
        (TYPE_THUMB_VTT, 'Thumbnail VTT'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='assets')
    asset_type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    object_key = models.CharField(max_length=512)
    content_type = models.CharField(max_length=120, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['asset_type', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['session', 'asset_type'], name='session_asset_session_type_uniq'),
        ]

    def __str__(self):
        return f"SessionAsset session={self.session_id} type={self.asset_type}"


class MultipartSessionUpload(models.Model):
    """Tracks direct-to-S3 multipart uploads before a library video is created."""

    STATUS_INITIATED = 'initiated'
    STATUS_COMPLETED = 'completed'
    STATUS_ABORTED = 'aborted'
    STATUS_EXPIRED = 'expired'
    STATUS_CHOICES = [
        (STATUS_INITIATED, 'Initiated'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_ABORTED, 'Aborted'),
        (STATUS_EXPIRED, 'Expired'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='multipart_uploads')
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True, related_name='multipart_upload_records')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_INITIATED)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    reference_title = models.CharField(max_length=200, blank=True)
    reference_url = models.URLField(blank=True)
    tags_csv = models.TextField(blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.BigIntegerField()
    s3_key = models.CharField(max_length=512)
    s3_upload_id = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['expires_at']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['s3_key', 's3_upload_id'], name='multipart_upload_s3_key_upload_id_uniq'),
        ]

    def __str__(self):
        return f"MultipartUpload #{self.id} user={self.user_id} status={self.status}"


class Chapter(models.Model):
    """A timestamped marker within a session, linked to an exercise."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='chapters')
    exercise = models.ForeignKey(Exercise, on_delete=models.SET_NULL, null=True, blank=True, related_name='chapters')
    title = models.CharField(max_length=200, blank=True)
    timestamp_seconds = models.IntegerField(help_text="Start time in the video (seconds)")
    end_seconds = models.IntegerField(null=True, blank=True, help_text="End time (seconds), optional")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp_seconds']

    def __str__(self):
        label = self.exercise.name if self.exercise else self.title
        mins, secs = divmod(self.timestamp_seconds, 60)
        return f"{label} @ {mins}:{secs:02d}"
class SessionLastSeen(models.Model):
    """Tracks when a user last viewed a session's video feedback."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_views')
    session = models.ForeignKey('Session', on_delete=models.CASCADE, related_name='last_seen_by')
    seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'session']


class VideoFeedback(models.Model):
    """A timestamped video feedback response on a session."""
    CATEGORY_TIMING = 'timing'
    CATEGORY_GROOVE = 'groove'
    CATEGORY_DYNAMICS = 'dynamics'
    CATEGORY_TECHNIQUE = 'technique'
    CATEGORY_POSTURE = 'posture'
    CATEGORY_TONE = 'tone'
    CATEGORY_CHOICES = [
        (CATEGORY_TIMING, 'Timing'),
        (CATEGORY_GROOVE, 'Groove'),
        (CATEGORY_DYNAMICS, 'Dynamics'),
        (CATEGORY_TECHNIQUE, 'Technique'),
        (CATEGORY_POSTURE, 'Posture'),
        (CATEGORY_TONE, 'Tone'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='video_feedback')
    review_request = models.ForeignKey('ReviewRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_items')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_feedback')
    feedback_category = models.CharField(max_length=24, choices=CATEGORY_CHOICES, blank=True)
    timestamp_seconds = models.IntegerField(null=True, blank=True)
    text = models.TextField()
    feedback_video = models.FileField(upload_to='feedback_videos/', null=True, blank=True)
    is_legacy_text_feedback = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp_seconds', 'created_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(is_legacy_text_feedback=True) | (models.Q(feedback_video__isnull=False) & ~models.Q(feedback_video='')),
                name='video_feedback_legacy_or_video_required',
            ),
        ]

    def __str__(self):
        prefix = f"@{self.timestamp_seconds}s " if self.timestamp_seconds is not None else ""
        return f"{prefix}{self.user}: {self.text[:50]}"
# ── Private feedback links ──────────────────────────────────────────

class ReviewLink(models.Model):
    """A time-limited private link for requesting authenticated video feedback."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='review_links')
    token = models.CharField(max_length=40, unique=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_review_links')
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    allow_video_feedback = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ReviewLink {self.token} session={self.session_id} active={self.is_active}"


class TeacherRosterMembership(models.Model):
    """A lightweight teacher-student relationship for repeat async review workflows."""

    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='teacher_roster_memberships')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_roster_memberships')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_teacher_roster_memberships')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['teacher_id', 'student_id']
        constraints = [
            models.UniqueConstraint(fields=['teacher', 'student'], name='teacher_roster_membership_teacher_student_uniq'),
        ]

    def __str__(self):
        return f"TeacherRosterMembership teacher={self.teacher_id} student={self.student_id} active={self.is_active}"


class ReviewRequest(models.Model):
    """A structured teacher-owned review workflow around a student session."""

    STATUS_REQUESTED = 'requested'
    STATUS_OPENED = 'opened'
    STATUS_RESPONDED = 'responded'
    STATUS_VIEWED = 'viewed'
    STATUS_RESUBMITTED = 'resubmitted'
    STATUS_CLOSED = 'closed'
    STATUS_REVOKED = 'revoked'
    STATUS_CHOICES = [
        (STATUS_REQUESTED, 'Requested'),
        (STATUS_OPENED, 'Opened'),
        (STATUS_RESPONDED, 'Responded'),
        (STATUS_VIEWED, 'Viewed'),
        (STATUS_RESUBMITTED, 'Resubmitted'),
        (STATUS_CLOSED, 'Closed'),
        (STATUS_REVOKED, 'Revoked'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='review_requests')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='review_requests_as_student')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='review_requests_as_teacher')
    parent_request = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='follow_up_requests')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_review_requests_v2')
    review_link = models.OneToOneField(ReviewLink, on_delete=models.SET_NULL, null=True, blank=True, related_name='review_request')
    instrument = models.CharField(max_length=64)
    student_level = models.CharField(max_length=64, blank=True)
    goal = models.CharField(max_length=255)
    exercise_or_song = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    requested_turnaround_hours = models.PositiveIntegerField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    opened_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    resubmitted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['teacher', 'status']),
            models.Index(fields=['student', 'status']),
        ]

    def __str__(self):
        return f"ReviewRequest #{self.id} session={self.session_id} teacher={self.teacher_id} status={self.status}"


class FeedbackTemplate(models.Model):
    """Reusable teacher note templates for faster async feedback."""

    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback_templates')
    title = models.CharField(max_length=120)
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title', '-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['teacher', 'title'], name='feedback_template_teacher_title_uniq'),
        ]

    def __str__(self):
        return f"FeedbackTemplate teacher={self.teacher_id} title={self.title}"
