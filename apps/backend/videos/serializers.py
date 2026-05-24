from django.contrib.auth.models import User
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.core.files.storage import default_storage
from rest_framework import serializers
from .models import (
    Profile, Session, Chapter, VideoFeedback,
    SessionAsset,
    ReviewLink,
    ReviewRequest,
    ReviewRequestEvent,
    ReviewerRosterMembership,
    FeedbackTemplate,
    SignupInviteCode,
    ReviewerInvite,
)
from .reviews.presentation import resolve_review_request_resolution, resolve_reviewer_invite_resolution, resolve_session_resolution
from .services.feedback_video_processing import feedback_video_playback_url
from .video_uploads import is_allowed_video_upload
from videos.media.uploads import parse_timing_metadata


def _media_url_for_key(key):
    normalized_key = str(key or '').strip().lstrip('/')
    if not normalized_key:
        return ''
    media_base = str(getattr(settings, 'MEDIA_URL', '/media/') or '/media/').strip()
    if not media_base.endswith('/'):
        media_base = f'{media_base}/'
    if media_base.startswith('http://') or media_base.startswith('https://') or media_base.startswith('/'):
        return f'{media_base}{normalized_key}'
    return f"/{media_base.lstrip('/')}{normalized_key}"


def _normalize_storage_url(raw_value, key=''):
    candidate = str(raw_value or '').strip()
    if not candidate:
        return _media_url_for_key(key)
    if candidate.startswith('http://') or candidate.startswith('https://') or candidate.startswith('/'):
        return candidate
    return _media_url_for_key(candidate or key)


class SafeFileField(serializers.FileField):
    def to_representation(self, value):
        fallback_key = str(getattr(value, 'name', '') or '')
        try:
            rendered = super().to_representation(value)
        except Exception:
            rendered = fallback_key
        return _normalize_storage_url(rendered, key=fallback_key)


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['display_name']




class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'display_name',
        ]
        read_only_fields = ['id']

    def get_display_name(self, obj):
        if hasattr(obj, 'profile') and obj.profile.display_name:
            return obj.profile.display_name
        return obj.username


class UserSummarySerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'display_name']

    def get_display_name(self, obj):
        if hasattr(obj, 'profile') and obj.profile.display_name:
            return obj.profile.display_name
        return obj.username


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    display_name = serializers.CharField(max_length=100, required=False, default='')
    invite_code = serializers.CharField(max_length=64, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_invite_code(self, value):
        normalized = str(value or '').strip().upper()
        if not normalized:
            raise serializers.ValidationError('Invite code is required.')
        return normalized

    def validate(self, attrs):
        invite_code = attrs.get('invite_code', '')
        invite = SignupInviteCode.objects.filter(code__iexact=invite_code).order_by('-created_at').first()
        reviewer_invite = None
        if invite:
            try:
                reviewer_invite = invite.reviewer_invite
            except ReviewerInvite.DoesNotExist:
                reviewer_invite = None
        if reviewer_invite:
            reviewer_invite.mark_expired_if_needed(save=True)
        if not invite or not invite.can_redeem():
            raise serializers.ValidationError({'invite_code': 'Invalid or exhausted invite code.'})
        attrs['invite_record_id'] = invite.id
        return attrs

    def create(self, validated_data):
        invite_record_id = validated_data.pop('invite_record_id')
        validated_data.pop('invite_code', None)

        with transaction.atomic():
            invite = SignupInviteCode.objects.select_for_update().get(pk=invite_record_id)
            if not invite.can_redeem():
                raise serializers.ValidationError({'invite_code': 'Invalid or exhausted invite code.'})

            user = User.objects.create_user(
                username=validated_data['username'],
                password=validated_data['password'],
            )
            Profile.objects.create(
                user=user,
                display_name=validated_data.get('display_name', ''),
            )

            invite.use_count += 1
            invite.last_used_at = timezone.now()
            invite.save(update_fields=['use_count', 'last_used_at', 'updated_at'])

            try:
                reviewer_invite = invite.reviewer_invite
            except ReviewerInvite.DoesNotExist:
                reviewer_invite = None
            if reviewer_invite:
                from videos.reviews.services import claim_reviewer_invite

                claim_reviewer_invite(reviewer_invite=reviewer_invite, actor=user, deactivate_signup_code=False)

        return user




class SessionAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = SessionAsset
        fields = ['asset_type', 'object_key', 'content_type', 'metadata_json', 'url']

    def get_url(self, obj):
        key = (obj.object_key or '').strip()
        if not key:
            return ''
        if key.startswith('http://') or key.startswith('https://') or key.startswith('/'):
            return key
        try:
            raw_url = default_storage.url(key)
        except Exception:
            raw_url = key
        return _normalize_storage_url(raw_url, key=key)


class VideoFeedbackSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.SerializerMethodField()
    authored_by_current_user = serializers.SerializerMethodField()
    review_request_id = serializers.IntegerField(read_only=True)
    feedback_video = serializers.SerializerMethodField()

    class Meta:
        model = VideoFeedback
        fields = ['id', 'session', 'user', 'username', 'display_name',
                  'authored_by_current_user', 'feedback_category', 'timestamp_seconds', 'text', 'feedback_video', 'review_request_id', 'created_at']
        read_only_fields = ['id', 'user', 'username', 'display_name', 'created_at']

    def get_display_name(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username

    def get_authored_by_current_user(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return bool(user and user.is_authenticated and obj.user_id == user.id)

    def get_feedback_video(self, obj):
        return feedback_video_playback_url(obj)


class ChapterSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True, default=None)

    class Meta:
        model = Chapter
        fields = ['id', 'session', 'exercise', 'exercise_name',
                  'title', 'timestamp_seconds', 'end_seconds', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']




class SessionSerializer(serializers.ModelSerializer):
    chapters = ChapterSerializer(many=True, read_only=True)
    video_feedback = VideoFeedbackSerializer(many=True, read_only=True)
    active_review_link = serializers.SerializerMethodField()
    tag_names = serializers.SerializerMethodField()
    chapter_count = serializers.SerializerMethodField()
    video_feedback_count = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    video_file = SafeFileField()
    processing_status = serializers.CharField(read_only=True)
    processing_job_id = serializers.CharField(read_only=True)
    processing_error = serializers.CharField(read_only=True)
    assets = SessionAssetSerializer(many=True, read_only=True)
    poster_image_url = serializers.SerializerMethodField()
    resolution = serializers.SerializerMethodField()
    client_upload_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    timing_metadata = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'practice_series', 'description', 'video_file',
                  'reference_title', 'reference_url',
                  'duration_seconds', 'timing_metadata', 'recorded_at', 'created_at', 'updated_at',
                  'processing_status', 'processing_job_id', 'processing_error',
                  'poster_image_url',
                  'resolution',
                  'client_upload_id',
                  'ml_training_enabled', 'ml_training_consent_source', 'ml_training_consent_at',
                  'ml_training_consent_revoked_at', 'ml_training_consent_revocation_source',
                  'tag_names', 'assets',
                  'chapters', 'video_feedback', 'active_review_link', 'chapter_count', 'video_feedback_count', 'owner',
                  'can_edit']
        read_only_fields = [
            'id', 'recorded_at', 'created_at', 'updated_at',
            'ml_training_enabled', 'ml_training_consent_source', 'ml_training_consent_at',
            'ml_training_consent_revoked_at', 'ml_training_consent_revocation_source',
        ]

    def get_tag_names(self, obj):
        return [t.name for t in obj.tags.all()]

    def get_poster_image_url(self, obj):
        asset = obj.assets.filter(asset_type=SessionAsset.TYPE_THUMB_SPRITE).order_by('-created_at').first()
        if not asset:
            return ''
        return SessionAssetSerializer(asset, context=self.context).data.get('url', '')

    def get_chapter_count(self, obj):
        return obj.chapters.count()

    def get_video_feedback_count(self, obj):
        return obj.video_feedback.count()

    def get_active_review_link(self, obj):
        user = self._request_user()
        if not user or not (user.is_staff or obj.user_id == user.id):
            return None

        link = obj.review_links.filter(is_active=True, expires_at__gt=timezone.now()).order_by('-created_at').first()
        if not link:
            return None
        return ReviewLinkSerializer(link, context=self.context).data

    def get_owner(self, obj):
        if obj.user:
            name = obj.user.profile.display_name if hasattr(obj.user, 'profile') and obj.user.profile.display_name else obj.user.username
            return {'id': obj.user.id, 'display_name': name}
        return None

    def _request_user(self):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        return request.user

    def get_can_edit(self, obj):
        user = self._request_user()
        if not user:
            return False
        return user.is_staff or obj.user_id == user.id

    def get_resolution(self, obj):
        return resolve_session_resolution(obj, self._request_user())

    def validate_video_file(self, value):
        if value and not is_allowed_video_upload(getattr(value, 'content_type', ''), getattr(value, 'name', '')):
            raise serializers.ValidationError('Only video files allowed.')
        return value

    def validate_timing_metadata(self, value):
        return parse_timing_metadata(value)

class SessionListSerializer(serializers.ModelSerializer):
    video_feedback_count = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    video_file = SafeFileField()
    processing_status = serializers.CharField(read_only=True)
    processing_job_id = serializers.CharField(read_only=True)
    processing_error = serializers.CharField(read_only=True)
    assets = SessionAssetSerializer(many=True, read_only=True)
    poster_image_url = serializers.SerializerMethodField()
    resolution = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'title', 'practice_series', 'description', 'video_file',
                  'duration_seconds', 'timing_metadata', 'recorded_at', 'created_at',
                  'processing_status', 'processing_job_id', 'processing_error',
                  'poster_image_url', 'resolution', 'assets', 'video_feedback_count',
                  'can_edit']
        read_only_fields = ['id', 'recorded_at', 'created_at']

    def get_video_feedback_count(self, obj):
        return obj.video_feedback.count()

    def get_poster_image_url(self, obj):
        asset = obj.assets.filter(asset_type=SessionAsset.TYPE_THUMB_SPRITE).order_by('-created_at').first()
        if not asset:
            return ''
        return SessionAssetSerializer(asset, context=self.context).data.get('url', '')

    def _request_user(self):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        return request.user

    def get_can_edit(self, obj):
        user = self._request_user()
        if not user:
            return False
        return user.is_staff or obj.user_id == user.id

    def get_resolution(self, obj):
        return resolve_session_resolution(obj, self._request_user())



class PublicSessionSerializer(serializers.ModelSerializer):
    video_file = SafeFileField()
    assets = SessionAssetSerializer(many=True, read_only=True)
    poster_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'title', 'practice_series', 'description', 'video_file', 'duration_seconds', 'recorded_at', 'assets', 'poster_image_url', 'processing_status', 'processing_job_id', 'processing_error']
        read_only_fields = fields

    def get_poster_image_url(self, obj):
        asset = obj.assets.filter(asset_type=SessionAsset.TYPE_THUMB_SPRITE).order_by('-created_at').first()
        if not asset:
            return ''
        return SessionAssetSerializer(asset, context=self.context).data.get('url', '')


class ReviewLinkSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ReviewLink
        fields = ['token', 'expires_at', 'is_active', 'allow_video_feedback', 'url']
        read_only_fields = ['token', 'expires_at', 'is_active', 'allow_video_feedback', 'url']

    def get_url(self, obj):
        request = self.context.get('request')
        base = request.build_absolute_uri('/') if request else '/'
        if not settings.DEBUG and base.startswith('http://'):
            base = base.replace('http://', 'https://', 1)
        base = base.rstrip('/')
        return f"{base}/r/{obj.token}"


class ReviewVideoFeedbackSerializer(serializers.ModelSerializer):
    author_display_name = serializers.SerializerMethodField()
    authored_by_current_user = serializers.SerializerMethodField()
    review_request_id = serializers.IntegerField(read_only=True)
    text = serializers.CharField(required=False, allow_blank=True)
    feedback_category = serializers.ChoiceField(choices=VideoFeedback.CATEGORY_CHOICES, required=False, allow_blank=True, default='')
    feedback_video = serializers.SerializerMethodField()

    class Meta:
        model = VideoFeedback
        fields = [
            'id', 'author_display_name', 'authored_by_current_user',
            'text', 'feedback_category', 'timestamp_seconds', 'feedback_video', 'review_request_id', 'created_at',
        ]
        read_only_fields = ['id', 'author_display_name', 'authored_by_current_user', 'created_at']

    def get_author_display_name(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username

    def get_feedback_video(self, obj):
        return feedback_video_playback_url(obj)

    def get_authored_by_current_user(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return bool(user and user.is_authenticated and obj.user_id == user.id)

    def validate_timestamp_seconds(self, value):
        if value is None:
            return value
        if value < 0:
            raise serializers.ValidationError('Timestamp must be 0 or greater.')

        session = self.context.get('session')
        duration_seconds = getattr(session, 'duration_seconds', None) if session else None
        if duration_seconds is not None and value > int(duration_seconds):
            raise serializers.ValidationError('Timestamp must be within the video duration.')
        return value

    def validate_feedback_category(self, value):
        return str(value or '').strip().lower()

    def validate_feedback_video(self, value):
        if value and not is_allowed_video_upload(getattr(value, 'content_type', ''), getattr(value, 'name', '')):
            raise serializers.ValidationError('Only video files allowed.')
        return value


class ReviewRequestEventSerializer(serializers.ModelSerializer):
    actor = UserSummarySerializer(read_only=True)

    class Meta:
        model = ReviewRequestEvent
        fields = ['id', 'event_type', 'from_status', 'to_status', 'reason_code', 'note', 'actor', 'created_at']
        read_only_fields = fields


class ReviewRequestSerializer(serializers.ModelSerializer):
    student = UserSummarySerializer(read_only=True)
    creator = UserSummarySerializer(source='student', read_only=True)
    member = UserSummarySerializer(source='student', read_only=True)
    owner = UserSummarySerializer(source='student', read_only=True)
    reviewer = UserSummarySerializer(read_only=True)
    creator_id = serializers.IntegerField(source='student_id', read_only=True)
    member_id = serializers.IntegerField(source='student_id', read_only=True)
    owner_id = serializers.IntegerField(source='student_id', read_only=True)
    reviewer_id = serializers.PrimaryKeyRelatedField(
        source='reviewer',
        queryset=User.objects.all(),
        write_only=True,
        required=False,
    )
    session = SessionListSerializer(read_only=True)
    session_id = serializers.PrimaryKeyRelatedField(
        source='session',
        queryset=Session.objects.all(),
        write_only=True,
        required=True,
    )
    review_link = ReviewLinkSerializer(read_only=True)
    feedback_link = ReviewLinkSerializer(source='review_link', read_only=True)
    parent_request = serializers.SerializerMethodField()
    parent_feedback_request = serializers.SerializerMethodField()
    parent_request_id = serializers.PrimaryKeyRelatedField(
        source='parent_request',
        queryset=ReviewRequest.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    response_count = serializers.SerializerMethodField()
    current_user_role = serializers.SerializerMethodField()
    current_member_role = serializers.SerializerMethodField()
    feedback_items = serializers.SerializerMethodField()
    latest_feedback_at = serializers.SerializerMethodField()
    follow_up_request_count = serializers.SerializerMethodField()
    feedback_category_counts = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    resolution = serializers.SerializerMethodField()
    notification_delivery = serializers.SerializerMethodField()

    class Meta:
        model = ReviewRequest
        fields = [
            'id',
            'session', 'session_id',
            'student', 'creator', 'member',
            'creator_id', 'member_id', 'owner', 'owner_id', 'reviewer', 'reviewer_id',
            'review_link', 'feedback_link',
            'parent_request', 'parent_request_id',
            'parent_feedback_request',
            'instrument', 'student_level', 'goal', 'exercise_or_song', 'notes',
            'requested_turnaround_hours', 'deadline',
            'status', 'status_reason', 'status_note', 'opened_at', 'responded_at', 'viewed_at', 'flagged_at', 'resubmitted_at', 'closed_at',
            'response_count', 'current_user_role', 'current_member_role', 'feedback_items', 'latest_feedback_at', 'follow_up_request_count', 'feedback_category_counts', 'events', 'resolution',
            'notification_delivery',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'student', 'creator', 'member', 'creator_id', 'member_id', 'owner', 'reviewer', 'session', 'review_link', 'feedback_link', 'parent_request', 'parent_feedback_request',
            'status', 'status_reason', 'status_note', 'opened_at', 'responded_at', 'viewed_at', 'flagged_at', 'resubmitted_at', 'closed_at',
            'response_count', 'current_user_role', 'current_member_role', 'feedback_items', 'latest_feedback_at', 'follow_up_request_count', 'feedback_category_counts', 'events', 'resolution', 'notification_delivery',
            'created_at', 'updated_at',
        ]

    def _reviewer_validation_error(self, message):
        return serializers.ValidationError({'reviewer_id': message})

    def to_internal_value(self, data):
        payload = data.copy() if hasattr(data, 'copy') else dict(data)
        if isinstance(payload, dict) and 'reviewer_id' not in payload and 'teacher_id' in payload:
            payload['reviewer_id'] = payload.get('teacher_id')
        return super().to_internal_value(payload)

    def get_parent_request(self, obj):
        parent = obj.parent_request
        if not parent:
            return None
        return {
            'id': parent.id,
            'session_id': parent.session_id,
            'goal': parent.goal,
            'status': parent.status,
        }

    def get_parent_feedback_request(self, obj):
        return self.get_parent_request(obj)

    def get_response_count(self, obj):
        return obj.feedback_items.count()

    def get_current_user_role(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return ''
        if user.id == obj.reviewer_id:
            return 'reviewer'
        if user.id == obj.student_id:
            return 'owner'
        return ''

    def get_current_member_role(self, obj):
        return self.get_current_user_role(obj)

    def get_feedback_items(self, obj):
        feedback = obj.feedback_items.select_related('user', 'user__profile').order_by('timestamp_seconds', 'created_at')
        return ReviewVideoFeedbackSerializer(feedback, many=True, context=self.context).data

    def get_latest_feedback_at(self, obj):
        latest = obj.feedback_items.order_by('-created_at').values_list('created_at', flat=True).first()
        return latest

    def get_follow_up_request_count(self, obj):
        return obj.follow_up_requests.count()

    def get_feedback_category_counts(self, obj):
        counts = {}
        for feedback_item in obj.feedback_items.all():
            category = str(feedback_item.feedback_category or '').strip().lower()
            if not category:
                continue
            counts[category] = counts.get(category, 0) + 1
        return counts

    def get_events(self, obj):
        events = obj.events.select_related('actor', 'actor__profile').all()
        return ReviewRequestEventSerializer(events, many=True, context=self.context).data

    def get_resolution(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return resolve_review_request_resolution(obj, user)

    def get_notification_delivery(self, obj):
        return getattr(obj, '_notification_delivery', None)

    def validate(self, attrs):
        session = attrs.get('session') or getattr(self.instance, 'session', None)
        reviewer = attrs.get('reviewer') or getattr(self.instance, 'reviewer', None)
        parent_request = attrs.get('parent_request') or getattr(self.instance, 'parent_request', None)
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None

        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentication required.')
        if session and session.user_id != user.id and not user.is_staff:
            raise serializers.ValidationError({'session_id': 'You can only request review on your own sessions.'})
        if session and session.processing_status != Session.STATUS_READY:
            raise serializers.ValidationError({'session_id': 'This session must be playback ready before requesting review.'})
        if not reviewer:
            raise self._reviewer_validation_error('Choose a reviewer.')
        if reviewer and reviewer.id == user.id:
            raise self._reviewer_validation_error('Choose a reviewer other than yourself.')
        if parent_request:
            if parent_request.student_id != user.id and not user.is_staff:
                raise serializers.ValidationError({'parent_request_id': 'You can only follow up on your own review requests.'})
            if reviewer and parent_request.reviewer_id != reviewer.id:
                raise self._reviewer_validation_error('Follow-up requests must use the same reviewer as the parent request.')
            if session and parent_request.session_id == session.id:
                raise serializers.ValidationError({'session_id': 'Choose a new session for this follow-up request.'})
        if reviewer and not ReviewerRosterMembership.objects.filter(
            reviewer=reviewer,
            student=user,
            is_active=True,
        ).exists():
            raise self._reviewer_validation_error('Choose a designated reviewer from your roster.')
        return attrs


class MemberConnectionSerializer(serializers.ModelSerializer):
    student = UserSummarySerializer(read_only=True)
    creator = UserSummarySerializer(source='student', read_only=True)
    member = UserSummarySerializer(source='student', read_only=True)
    reviewer = UserSummarySerializer(read_only=True)
    pending_review_count = serializers.SerializerMethodField()
    total_review_count = serializers.SerializerMethodField()
    last_request_at = serializers.SerializerMethodField()

    class Meta:
        model = ReviewerRosterMembership
        fields = [
            'id', 'student', 'creator', 'member', 'reviewer', 'is_active',
            'pending_review_count', 'total_review_count', 'last_request_at',
            'created_at', 'updated_at',
        ]

    def _request_user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None) if request else None

    def _review_request_scope(self, obj):
        request_user = self._request_user()
        if not request_user or not request_user.is_authenticated:
            return None
        if request_user.id == obj.reviewer_id:
            return {'reviewer': request_user, 'student': obj.student}
        if request_user.id == obj.student_id:
            return {'reviewer': obj.reviewer, 'student': request_user}
        return None

    def get_pending_review_count(self, obj):
        scope = self._review_request_scope(obj)
        if not scope:
            return 0
        return ReviewRequest.objects.filter(
            reviewer=scope['reviewer'],
            student=scope['student'],
            status__in=[ReviewRequest.STATUS_REQUESTED, ReviewRequest.STATUS_OPENED],
        ).count()

    def get_total_review_count(self, obj):
        scope = self._review_request_scope(obj)
        if not scope:
            return 0
        return ReviewRequest.objects.filter(
            reviewer=scope['reviewer'],
            student=scope['student'],
        ).count()

    def get_last_request_at(self, obj):
        scope = self._review_request_scope(obj)
        if not scope:
            return None
        last_request = ReviewRequest.objects.filter(
            reviewer=scope['reviewer'],
            student=scope['student'],
        ).order_by('-created_at').first()
        return last_request.created_at if last_request else None


ReviewerRosterStudentSerializer = MemberConnectionSerializer


class FeedbackTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackTemplate
        fields = ['id', 'title', 'text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        normalized = str(value or '').strip()
        if not normalized:
            raise serializers.ValidationError('Title is required.')
        return normalized

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        title = attrs.get('title') or getattr(self.instance, 'title', '')
        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentication required.')
        existing = FeedbackTemplate.objects.filter(reviewer=user, title__iexact=title.strip())
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError({'title': 'You already have a template with this title.'})
        return attrs


class SignupInviteCodeSerializer(serializers.ModelSerializer):
    redeemable = serializers.SerializerMethodField()

    class Meta:
        model = SignupInviteCode
        fields = ['id', 'code', 'label', 'is_active', 'max_uses', 'use_count', 'last_used_at', 'redeemable', 'created_at']
        read_only_fields = ['id', 'code', 'is_active', 'use_count', 'last_used_at', 'redeemable', 'created_at']

    def get_redeemable(self, obj):
        return obj.can_redeem()


class ReviewerInviteSerializer(serializers.ModelSerializer):
    student = UserSummarySerializer(read_only=True)
    creator = UserSummarySerializer(source='student', read_only=True)
    member = UserSummarySerializer(source='student', read_only=True)
    owner = UserSummarySerializer(source='student', read_only=True)
    claimed_by = UserSummarySerializer(read_only=True)
    review_link = ReviewLinkSerializer(read_only=True)
    session = SessionListSerializer(read_only=True)
    claim_code = serializers.CharField(source='invite_code.code', read_only=True)
    invite_url = serializers.SerializerMethodField()
    resolution = serializers.SerializerMethodField()

    class Meta:
        model = ReviewerInvite
        fields = [
            'id', 'label', 'intent', 'status', 'claim_code', 'invite_url', 'resolution',
            'student', 'creator', 'member', 'owner', 'claimed_by', 'claimed_at', 'expires_at',
            'session', 'review_link', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_status(self, obj):
        return obj.mark_expired_if_needed(save=True)

    def to_representation(self, instance):
        instance.mark_expired_if_needed(save=True)
        payload = super().to_representation(instance)
        payload['status'] = instance.status
        return payload

    def get_invite_url(self, obj):
        link = obj.review_link
        if not link:
            return ''
        request = self.context.get('request')
        base = ReviewLinkSerializer(link, context={'request': request}).data.get('url', '')
        claim_code = str(getattr(obj.invite_code, 'code', '') or '').strip()
        if not base or not claim_code:
            return base
        separator = '&' if '?' in base else '?'
        return f'{base}{separator}claim={claim_code}'

    def get_resolution(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        return resolve_reviewer_invite_resolution(obj, user)
