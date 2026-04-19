from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
import secrets
from django.utils import timezone


class Profile(models.Model):
    """Extended user profile."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.display_name or self.user.username


class SignupInviteCode(models.Model):
    code = models.CharField(max_length=64, unique=True, blank=True)
    label = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_signup_invite_codes')
    is_active = models.BooleanField(default=True)
    max_uses = models.PositiveIntegerField(default=1)
    use_count = models.PositiveIntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.code:
            while True:
                candidate = secrets.token_urlsafe(8).replace('-', '').replace('_', '')[:12].upper()
                if not SignupInviteCode.objects.filter(code=candidate).exists():
                    self.code = candidate
                    break
        super().save(*args, **kwargs)

    def can_redeem(self):
        return self.is_active and self.use_count < self.max_uses

    def __str__(self):
        return f"SignupInviteCode {self.code} uses={self.use_count}/{self.max_uses} active={self.is_active}"


class ReviewerInvite(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_CLAIMED = 'claimed'
    STATUS_REVOKED = 'revoked'
    STATUS_EXPIRED = 'expired'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_CLAIMED, 'Claimed'),
        (STATUS_REVOKED, 'Revoked'),
        (STATUS_EXPIRED, 'Expired'),
    ]

    INTENT_LIGHTWEIGHT_REVIEW = 'lightweight_review'
    INTENT_ROSTER_JOIN = 'roster_join'
    INTENT_CHOICES = [
        (INTENT_LIGHTWEIGHT_REVIEW, 'Lightweight Review'),
        (INTENT_ROSTER_JOIN, 'Roster Join'),
    ]

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_reviewer_invites')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviewer_invites')
    invite_code = models.OneToOneField(SignupInviteCode, on_delete=models.CASCADE, related_name='reviewer_invite')
    review_link = models.ForeignKey('ReviewLink', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewer_invites')
    session = models.ForeignKey('Session', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewer_invites')
    review_request = models.ForeignKey('ReviewRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewer_invites')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    intent = models.CharField(max_length=24, choices=INTENT_CHOICES, default=INTENT_LIGHTWEIGHT_REVIEW)
    claimed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='claimed_reviewer_invites')
    claimed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    label = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def mark_expired_if_needed(self, *, save=True):
        if self.status == self.STATUS_PENDING and self.expires_at <= timezone.now():
            self.status = self.STATUS_EXPIRED
            if self.invite_code_id and self.invite_code.is_active:
                self.invite_code.is_active = False
                if save:
                    self.invite_code.save(update_fields=['is_active', 'updated_at'])
            if save:
                self.save(update_fields=['status', 'updated_at'])
        return self.status

    def can_claim(self):
        self.mark_expired_if_needed(save=True)
        return self.status == self.STATUS_PENDING and self.invite_code.can_redeem()

    @property
    def owner(self):
        return self.student

    @owner.setter
    def owner(self, value):
        self.student = value

    @property
    def member(self):
        return self.student

    @member.setter
    def member(self, value):
        self.student = value

    def __str__(self):
        return f"ReviewerInvite {self.id} member={self.student_id} status={self.status} intent={self.intent}"

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
    """A learner-owned private take inside the practice mirror."""
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
    practice_series = models.CharField(max_length=200, blank=True, db_index=True)
    description = models.TextField(blank=True)
    reference_title = models.CharField(max_length=200, blank=True)
    reference_url = models.URLField(blank=True)
    video_file = models.FileField(upload_to='sessions/')
    processing_status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_UPLOADED)
    processing_job_id = models.CharField(max_length=64, blank=True, db_index=True)
    processing_error = models.TextField(blank=True)
    client_upload_id = models.CharField(max_length=64, blank=True, db_index=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='sessions')
    duration_seconds = models.IntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['user', 'recorded_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'client_upload_id'],
                condition=~Q(client_upload_id=''),
                name='session_user_client_upload_uniq',
            ),
        ]

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
    """Tracks direct-to-S3 multipart uploads before a private take is created."""

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
    practice_series = models.CharField(max_length=200, blank=True)
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
    client_upload_id = models.CharField(max_length=64, blank=True, db_index=True)
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
    """A time-limited private link for inviting trusted authenticated feedback."""
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


class ReviewerRosterMembership(models.Model):
    """A lightweight trusted-reviewer relationship for repeat async feedback workflows."""

    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviewer_roster_memberships')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='student_roster_memberships')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_reviewer_roster_memberships')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['reviewer_id', 'student_id']
        constraints = [
            models.UniqueConstraint(fields=['reviewer', 'student'], name='reviewer_roster_membership_reviewer_student_uniq'),
        ]

    @property
    def member(self):
        return self.student

    @member.setter
    def member(self, value):
        self.student = value

    @property
    def inviter(self):
        return self.created_by

    @inviter.setter
    def inviter(self, value):
        self.created_by = value

    def __str__(self):
        return f"MemberConnection reviewer={self.reviewer_id} member={self.student_id} active={self.is_active}"


class ReviewRequest(models.Model):
    """A structured trusted-feedback workflow around a learner-owned take."""

    STATUS_REQUESTED = 'requested'
    STATUS_OPENED = 'opened'
    STATUS_RESPONDED = 'responded'
    STATUS_VIEWED = 'viewed'
    STATUS_NEEDS_RESUBMISSION = 'needs_resubmission'
    STATUS_DECLINED_UNRELATED = 'declined_unrelated'
    STATUS_FLAGGED = 'flagged'
    STATUS_RESUBMITTED = 'resubmitted'
    STATUS_CLOSED = 'closed'
    STATUS_REVOKED = 'revoked'
    STATUS_CHOICES = [
        (STATUS_REQUESTED, 'Requested'),
        (STATUS_OPENED, 'Opened'),
        (STATUS_RESPONDED, 'Responded'),
        (STATUS_VIEWED, 'Viewed'),
        (STATUS_NEEDS_RESUBMISSION, 'Needs Resubmission'),
        (STATUS_DECLINED_UNRELATED, 'Declined Unrelated'),
        (STATUS_FLAGGED, 'Flagged'),
        (STATUS_RESUBMITTED, 'Resubmitted'),
        (STATUS_CLOSED, 'Closed'),
        (STATUS_REVOKED, 'Revoked'),
    ]

    REASON_NEEDS_NEW_TAKE = 'needs_new_take'
    REASON_UNRELATED_VIDEO = 'unrelated_video'
    REASON_UNSAFE_CONTENT = 'unsafe_content'
    REASON_SPAM = 'spam'
    REASON_OTHER = 'other'

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='review_requests')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='review_requests_as_student')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='review_requests_as_reviewer')
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
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    status_reason = models.CharField(max_length=64, blank=True)
    status_note = models.TextField(blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    flagged_at = models.DateTimeField(null=True, blank=True)
    resubmitted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reviewer', 'status']),
            models.Index(fields=['student', 'status']),
        ]

    @property
    def owner(self):
        return self.student

    @owner.setter
    def owner(self, value):
        self.student = value

    @property
    def member(self):
        return self.student

    @member.setter
    def member(self, value):
        self.student = value

    @property
    def feedback_link(self):
        return self.review_link

    @feedback_link.setter
    def feedback_link(self, value):
        self.review_link = value

    @property
    def parent_feedback_request(self):
        return self.parent_request

    @parent_feedback_request.setter
    def parent_feedback_request(self, value):
        self.parent_request = value

    def member_role_for(self, user):
        if not user or not getattr(user, 'is_authenticated', False):
            return ''
        if user.id == self.reviewer_id:
            return 'reviewer'
        if user.id == self.student_id:
            return 'owner'
        return ''

    def __str__(self):
        return f"FeedbackRequest #{self.id} session={self.session_id} reviewer={self.reviewer_id} status={self.status}"


MemberConnection = ReviewerRosterMembership
FeedbackRequest = ReviewRequest


class ReviewRequestEvent(models.Model):
    EVENT_CREATED = 'created'
    EVENT_OPENED = 'opened'
    EVENT_STATUS_CHANGED = 'status_changed'
    EVENT_RESPONDED = 'responded'
    EVENT_VIEWED = 'viewed'
    EVENT_THREAD_RENAMED = 'thread_renamed'
    EVENT_TYPES = [
        (EVENT_CREATED, 'Created'),
        (EVENT_OPENED, 'Opened'),
        (EVENT_STATUS_CHANGED, 'Status Changed'),
        (EVENT_RESPONDED, 'Responded'),
        (EVENT_VIEWED, 'Viewed'),
        (EVENT_THREAD_RENAMED, 'Thread Renamed'),
    ]

    review_request = models.ForeignKey(ReviewRequest, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='review_request_events')
    event_type = models.CharField(max_length=32, choices=EVENT_TYPES)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, blank=True)
    reason_code = models.CharField(max_length=64, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['review_request', 'created_at']),
        ]

    def __str__(self):
        return f"ReviewRequestEvent request={self.review_request_id} type={self.event_type} to={self.to_status or 'n/a'}"


class FeedbackTemplate(models.Model):
    """Reusable reviewer note templates for faster trusted async feedback."""

    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback_templates')
    title = models.CharField(max_length=120)
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title', '-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['reviewer', 'title'], name='feedback_template_reviewer_title_uniq'),
        ]

    def __str__(self):
        return f"FeedbackTemplate reviewer={self.reviewer_id} title={self.title}"


class ProductEventLog(models.Model):
    event_name = models.CharField(max_length=80, db_index=True)
    path = models.CharField(max_length=512, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_event_logs')
    is_authenticated = models.BooleanField(default=False)
    client_trace_id = models.CharField(max_length=128, blank=True)
    extra_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['event_name', 'created_at']),
        ]

    def __str__(self):
        return f"ProductEventLog event={self.event_name} at={self.created_at.isoformat()}"
