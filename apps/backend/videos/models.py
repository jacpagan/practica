import secrets
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Profile(models.Model):
    """Extended user profile."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.display_name or self.user.username


class Space(models.Model):
    """A practice area. Owner shows their work, members watch and give feedback."""
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_spaces')
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
    """A person who follows a space (watches + gives feedback)."""
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
            models.CheckConstraint(check=models.Q(start_seconds__gte=0), name='exercise_clip_start_seconds_gte_0'),
            models.CheckConstraint(
                check=models.Q(end_seconds__isnull=True) | models.Q(end_seconds__gt=models.F('start_seconds')),
                name='exercise_clip_end_seconds_gt_start_or_null',
            ),
        ]

    def __str__(self):
        return f"ExerciseReferenceClip #{self.id} user={self.user_id} exercise={self.exercise_id}"


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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions', null=True, blank=True)
    space = models.ForeignKey(Space, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    video_file = models.FileField(upload_to='sessions/')
    tags = models.ManyToManyField(Tag, blank=True, related_name='sessions')
    duration_seconds = models.IntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return self.title


class MultipartSessionUpload(models.Model):
    """Tracks direct-to-S3 multipart uploads before session creation."""

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
    space = models.ForeignKey(Space, on_delete=models.SET_NULL, null=True, blank=True, related_name='multipart_uploads')
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True, related_name='multipart_upload_records')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_INITIATED)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
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
    """Tracks when a user last viewed a session's feedback."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_views')
    session = models.ForeignKey('Session', on_delete=models.CASCADE, related_name='last_seen_by')
    seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'session']


class Comment(models.Model):
    """A timestamped comment on a session, optionally with a video reply."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    timestamp_seconds = models.IntegerField(null=True, blank=True)
    text = models.TextField()
    video_reply = models.FileField(upload_to='comment_videos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp_seconds', 'created_at']

    def __str__(self):
        prefix = f"@{self.timestamp_seconds}s " if self.timestamp_seconds is not None else ""
        return f"{prefix}{self.user}: {self.text[:50]}"


class FeedbackRequest(models.Model):
    """Explicit request for time-bound feedback on a session."""

    STATUS_OPEN = 'open'
    STATUS_FULFILLED = 'fulfilled'
    STATUS_EXPIRED = 'expired'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_FULFILLED, 'Fulfilled'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='feedback_requests')
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback_requests')
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='feedback_requests')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_OPEN)
    sla_hours = models.PositiveIntegerField(default=48)
    due_at = models.DateTimeField()
    required_reviews = models.PositiveIntegerField(default=1)
    video_required_count = models.PositiveIntegerField(default=1)
    focus_prompt = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['due_at', '-created_at']
        constraints = [
            models.CheckConstraint(check=models.Q(sla_hours__gt=0), name='feedback_request_sla_hours_gt_0'),
            models.CheckConstraint(check=models.Q(required_reviews__gt=0), name='feedback_request_required_reviews_gt_0'),
            models.CheckConstraint(check=models.Q(video_required_count__gte=0), name='feedback_request_video_required_count_gte_0'),
            models.CheckConstraint(
                check=models.Q(video_required_count__lte=models.F('required_reviews')),
                name='feedback_request_video_required_lte_required_reviews',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.due_at:
            self.due_at = timezone.now() + timedelta(hours=self.sla_hours)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"FeedbackRequest #{self.id} session={self.session_id} status={self.status}"


class FeedbackAssignment(models.Model):
    """Claim/completion state for members reviewing a feedback request."""

    STATUS_CLAIMED = 'claimed'
    STATUS_COMPLETED = 'completed'
    STATUS_RELEASED = 'released'
    STATUS_EXPIRED = 'expired'
    STATUS_CHOICES = [
        (STATUS_CLAIMED, 'Claimed'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_RELEASED, 'Released'),
        (STATUS_EXPIRED, 'Expired'),
    ]

    feedback_request = models.ForeignKey(FeedbackRequest, on_delete=models.CASCADE, related_name='assignments')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback_assignments')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_CLAIMED)
    claimed_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_video_review = models.BooleanField(default=False)
    comment = models.ForeignKey(Comment, on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_assignments')

    class Meta:
        ordering = ['-claimed_at']
        unique_together = ['feedback_request', 'reviewer']

    def __str__(self):
        return f"FeedbackAssignment #{self.id} request={self.feedback_request_id} reviewer={self.reviewer_id} status={self.status}"


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
    feedback_request = models.ForeignKey(
        FeedbackRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coach_events',
    )
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
    feedback_completions_7d = models.PositiveIntegerField(default=0)
    feedback_completions_30d = models.PositiveIntegerField(default=0)
    median_time_to_feedback_hours_30d = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
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
