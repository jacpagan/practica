import secrets
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Profile(models.Model):
    """Extended user profile."""
    ROLE_STUDENT = 'student'
    ROLE_COACH = 'coach'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [
        (ROLE_STUDENT, 'Student'),
        (ROLE_COACH, 'Coach'),
        (ROLE_ADMIN, 'Admin'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_STUDENT)

    def __str__(self):
        return self.display_name or self.user.username


class Space(models.Model):
    """A practice area. Owner shows their work, members watch and comment."""
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_spaces')
    main_session = models.ForeignKey(
        'Session',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='main_in_spaces',
    )
    invite_slug = models.CharField(max_length=20, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ['name', 'owner']

    def save(self, *args, **kwargs):
        if not self.invite_slug:
            self.invite_slug = secrets.token_urlsafe(10)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.owner})"


class SpaceMember(models.Model):
    """A person who follows a space (watches + comments)."""
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='space_memberships')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['space', 'user']

    def __str__(self):
        return f"{self.user} in {self.space.name}"


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


class ExerciseReferenceClip(models.Model):
    """A user-specific YouTube reference slice for an exercise."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exercise_reference_clips')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='reference_clips')
    title = models.CharField(max_length=200)
    youtube_url = models.URLField()
    youtube_video_id = models.CharField(max_length=32)
    youtube_playlist_id = models.CharField(max_length=64, blank=True, default='')
    start_seconds = models.PositiveIntegerField(default=0)
    end_seconds = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'exercise', 'created_at'], name='exercise_clip_user_ex_time_idx'),
            models.Index(fields=['youtube_video_id'], name='exercise_clip_video_id_idx'),
            models.Index(fields=['youtube_playlist_id'], name='exercise_clip_playlist_id_idx'),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(start_seconds__gte=0), name='exercise_clip_start_seconds_gte_0'),
            models.CheckConstraint(
                condition=models.Q(end_seconds__isnull=True) | models.Q(end_seconds__gt=models.F('start_seconds')),
                name='exercise_clip_end_seconds_gt_start_or_null',
            ),
        ]

    def __str__(self):
        return f"ExerciseReferenceClip #{self.id} user={self.user_id} exercise={self.exercise_id}"


class PracticePlan(models.Model):
    """A coach-defined practice plan scoped to a space."""

    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='practice_plans')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_practice_plans')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default='America/Los_Angeles')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', 'name', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.space.name})"


class PracticePlanItem(models.Model):
    """A scheduled exercise within a practice plan."""

    plan = models.ForeignKey(PracticePlan, on_delete=models.CASCADE, related_name='items')
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name='practice_plan_items')
    sort_order = models.IntegerField(default=0)
    target_minutes = models.IntegerField(null=True, blank=True)
    target_reps = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    reference_clip = models.ForeignKey(
        ExerciseReferenceClip,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='practice_plan_items',
    )
    schedule_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.plan.name}: {self.exercise.name}"


class DailyCheckIn(models.Model):
    """A member's daily accountability check-in for a space."""

    STATUS_COMPLETE = 'complete'
    STATUS_PARTIAL = 'partial'
    STATUS_SKIPPED = 'skipped'
    STATUS_MISSED = 'missed'
    STATUS_CHOICES = [
        (STATUS_COMPLETE, 'Complete'),
        (STATUS_PARTIAL, 'Partial'),
        (STATUS_SKIPPED, 'Skipped'),
        (STATUS_MISSED, 'Missed'),
    ]

    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='daily_checkins')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_checkins')
    plan = models.ForeignKey(PracticePlan, null=True, blank=True, on_delete=models.SET_NULL, related_name='daily_checkins')
    date = models.DateField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PARTIAL)
    total_minutes = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    linked_session = models.ForeignKey(
        'Session',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='daily_checkins',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['space', 'user', 'date'], name='uniq_daily_checkin_space_user_date'),
        ]

    def __str__(self):
        return f"Check-in {self.space.name} {self.user_id} {self.date}"


class DailyCheckInItem(models.Model):
    """Per-plan-item completion data for a daily check-in."""

    checkin = models.ForeignKey(DailyCheckIn, on_delete=models.CASCADE, related_name='items')
    plan_item = models.ForeignKey(PracticePlanItem, on_delete=models.CASCADE, related_name='checkins')
    completed = models.BooleanField(default=False)
    minutes = models.IntegerField(null=True, blank=True)
    reps = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"CheckInItem checkin={self.checkin_id} plan_item={self.plan_item_id}"


class Tag(models.Model):
    """A freeform label for organizing sessions."""
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Session(models.Model):
    """A practice session — typically one long recording."""
    STATUS_DRAFT = 'draft'
    STATUS_UPLOAD_IN_PROGRESS = 'upload_in_progress'
    STATUS_UPLOADED = 'uploaded'
    STATUS_PROCESSING = 'processing'
    STATUS_READY = 'ready'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_UPLOAD_IN_PROGRESS, 'Upload in Progress'),
        (STATUS_UPLOADED, 'Uploaded'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_READY, 'Ready'),
        (STATUS_FAILED, 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions', null=True, blank=True)
    space = models.ForeignKey(Space, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    reference_title = models.CharField(max_length=200, blank=True)
    reference_url = models.URLField(blank=True)
    video_file = models.FileField(upload_to='sessions/')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    processing_status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_UPLOADED)
    processing_error = models.TextField(blank=True)
    source_video_object_key = models.CharField(max_length=512, blank=True)
    playback_hls_url = models.URLField(blank=True)
    playback_mp4_url = models.URLField(blank=True)
    thumbnail_url = models.URLField(blank=True)
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
    """Tracks direct-to-S3 multipart uploads before session creation."""

    STATUS_INITIATED = 'initiated'
    STATUS_UPLOADING = 'uploading'
    STATUS_COMPLETED = 'completed'
    STATUS_ABORTED = 'aborted'
    STATUS_EXPIRED = 'expired'
    STATUS_CHOICES = [
        (STATUS_INITIATED, 'Initiated'),
        (STATUS_UPLOADING, 'Uploading'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_ABORTED, 'Aborted'),
        (STATUS_EXPIRED, 'Expired'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='multipart_uploads')
    space = models.ForeignKey(Space, on_delete=models.SET_NULL, null=True, blank=True, related_name='multipart_uploads')
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


class InviteCode(models.Model):
    """A code for inviting someone — used for initial signup gating."""
    code = models.CharField(max_length=8, unique=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invite_codes')
    space = models.ForeignKey(Space, on_delete=models.CASCADE, null=True, blank=True, related_name='invite_codes')
    used_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='used_invites')
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_used(self):
        return self.used_by is not None

    def __str__(self):
        return f"{self.code} ({self.created_by})"


class SessionLastSeen(models.Model):
    """Tracks when a user last viewed a session's comments."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_views')
    session = models.ForeignKey('Session', on_delete=models.CASCADE, related_name='last_seen_by')
    seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'session']


class Comment(models.Model):
    """A timestamped comment on a session, with required video reply for new rows."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    timestamp_seconds = models.IntegerField(null=True, blank=True)
    text = models.TextField()
    video_reply = models.FileField(upload_to='comment_videos/', null=True, blank=True)
    legacy_text_only = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp_seconds', 'created_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(legacy_text_only=True) | (models.Q(video_reply__isnull=False) & ~models.Q(video_reply='')),
                name='comment_legacy_or_video_required',
            ),
        ]

    def __str__(self):
        prefix = f"@{self.timestamp_seconds}s " if self.timestamp_seconds is not None else ""
        return f"{prefix}{self.user}: {self.text[:50]}"


class CoachEvent(models.Model):
    """Internal telemetry events for coach ROI metrics."""

    EVENT_SESSION_UPLOADED = 'session_uploaded'
    EVENT_FEEDBACK_REQUESTED = 'feedback_requested'
    EVENT_FEEDBACK_CLAIMED = 'feedback_claimed'
    EVENT_FEEDBACK_COMPLETED = 'feedback_completed'
    EVENT_VIDEO_FEEDBACK_COMPLETED = 'video_feedback_completed'
    EVENT_TYPE_CHOICES = [
        (EVENT_SESSION_UPLOADED, 'Session Uploaded'),
        (EVENT_FEEDBACK_REQUESTED, 'Feedback Requested'),
        (EVENT_FEEDBACK_CLAIMED, 'Feedback Claimed'),
        (EVENT_FEEDBACK_COMPLETED, 'Feedback Completed'),
        (EVENT_VIDEO_FEEDBACK_COMPLETED, 'Video Feedback Completed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coach_events')
    event_type = models.CharField(max_length=32, choices=EVENT_TYPE_CHOICES)
    occurred_at = models.DateTimeField(default=timezone.now)
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True, related_name='coach_events')
    space = models.ForeignKey(Space, on_delete=models.SET_NULL, null=True, blank=True, related_name='coach_events')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['user', 'event_type', 'occurred_at'], name='coach_event_user_type_time_idx'),
        ]

    def __str__(self):
        return f"CoachEvent #{self.id} user={self.user_id} type={self.event_type}"


class CoachDailyMetric(models.Model):
    """Daily aggregate ROI metrics per coach."""

    coach = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coach_daily_metrics')
    date = models.DateField()
    active_students_30d = models.PositiveIntegerField(default=0)
    coach_comments_7d = models.PositiveIntegerField(default=0)
    coach_comments_30d = models.PositiveIntegerField(default=0)
    median_time_to_first_coach_comment_hours_30d = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estimated_time_saved_hours_30d = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        constraints = [
            models.UniqueConstraint(fields=['coach', 'date'], name='coach_daily_metric_cd_uniq'),
        ]
        indexes = [
            models.Index(fields=['coach', 'date'], name='coach_daily_metric_cd_idx'),
        ]

    def __str__(self):
        return f"CoachDailyMetric coach={self.coach_id} date={self.date}"


# ── Review links (magic share) ─────────────────────────────────────

class ReviewLink(models.Model):
    """A time-limited share token that grants public view access to a session."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='review_links')
    token = models.CharField(max_length=40, unique=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_review_links')
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    allow_comments = models.BooleanField(default=True)
    pin_code_hash = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ReviewLink {self.token} session={self.session_id} active={self.is_active}"


class ReviewFeedback(models.Model):
    """Lightweight comments from public reviewers via ReviewLink.

    Kept separate from internal Comment to avoid auth/user constraints.
    """
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='review_feedback')
    review_link = models.ForeignKey(ReviewLink, on_delete=models.CASCADE, related_name='feedback')
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    timestamp_seconds = models.IntegerField(null=True, blank=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp_seconds', 'created_at']

    def __str__(self):
        ts = f"@{self.timestamp_seconds}s " if self.timestamp_seconds is not None else ''
        who = self.name or 'Anonymous'
        return f"{ts}{who}: {self.text[:40]}"


class AnalyticsDaily(models.Model):
    """Per-user daily practice counters for dashboard stats."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analytics_daily')
    date = models.DateField()
    session_count = models.PositiveIntegerField(default=0)
    practice_minutes = models.PositiveIntegerField(default=0)
    comments_received = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        constraints = [
            models.UniqueConstraint(fields=['user', 'date'], name='analytics_daily_user_date_uniq'),
        ]
        indexes = [
            models.Index(fields=['user', 'date'], name='analytics_daily_user_date_idx'),
        ]

    def __str__(self):
        return f"AnalyticsDaily user={self.user_id} date={self.date}"
