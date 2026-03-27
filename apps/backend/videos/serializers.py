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
    TeacherRosterMembership,
    FeedbackTemplate,
    SignupInviteCode,
)
from .video_uploads import is_allowed_video_upload


class SafeFileField(serializers.FileField):
    def to_representation(self, value):
        try:
            return super().to_representation(value)
        except Exception:
            return str(getattr(value, 'name', '') or '')


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
            return default_storage.url(key)
        except Exception:
            return key


class VideoFeedbackSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.SerializerMethodField()
    review_request_id = serializers.IntegerField(read_only=True)
    feedback_video = SafeFileField(required=False, allow_null=True)

    class Meta:
        model = VideoFeedback
        fields = ['id', 'session', 'user', 'username', 'display_name',
                  'feedback_category', 'timestamp_seconds', 'text', 'feedback_video', 'review_request_id', 'created_at']
        read_only_fields = ['id', 'user', 'username', 'display_name', 'created_at']

    def get_display_name(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username


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
    processing_error = serializers.CharField(read_only=True)
    assets = SessionAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'practice_series', 'description', 'video_file',
                  'reference_title', 'reference_url',
                  'duration_seconds', 'recorded_at', 'created_at', 'updated_at',
                  'processing_status', 'processing_error',
                  'tag_names', 'assets',
                  'chapters', 'video_feedback', 'active_review_link', 'chapter_count', 'video_feedback_count', 'owner',
                  'can_edit']
        read_only_fields = ['id', 'recorded_at', 'created_at', 'updated_at']

    def get_tag_names(self, obj):
        return [t.name for t in obj.tags.all()]

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

    def validate_video_file(self, value):
        if value and not is_allowed_video_upload(getattr(value, 'content_type', ''), getattr(value, 'name', '')):
            raise serializers.ValidationError('Only video files allowed.')
        return value

class SessionListSerializer(serializers.ModelSerializer):
    video_feedback_count = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    video_file = SafeFileField()
    processing_status = serializers.CharField(read_only=True)
    processing_error = serializers.CharField(read_only=True)
    assets = SessionAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'practice_series', 'description', 'video_file',
                  'duration_seconds', 'recorded_at', 'created_at',
                  'processing_status', 'processing_error',
                  'assets', 'video_feedback_count',
                  'can_edit']
        read_only_fields = ['id', 'recorded_at', 'created_at']

    def get_video_feedback_count(self, obj):
        return obj.video_feedback.count()

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



class PublicSessionSerializer(serializers.ModelSerializer):
    video_file = SafeFileField()
    assets = SessionAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'practice_series', 'description', 'video_file', 'duration_seconds', 'recorded_at', 'assets', 'processing_status', 'processing_error']
        read_only_fields = fields


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
    text = serializers.CharField(required=False, allow_blank=True, default='')
    review_request_id = serializers.IntegerField(read_only=True)
    feedback_category = serializers.ChoiceField(choices=VideoFeedback.CATEGORY_CHOICES, required=False, allow_blank=True, default='')
    feedback_video = SafeFileField(required=False, allow_null=True)

    class Meta:
        model = VideoFeedback
        fields = [
            'id', 'author_display_name', 'authored_by_current_user',
            'feedback_category', 'timestamp_seconds', 'text', 'feedback_video', 'review_request_id', 'created_at',
        ]
        read_only_fields = ['id', 'author_display_name', 'authored_by_current_user', 'created_at']

    def get_author_display_name(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username

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


class ReviewRequestSerializer(serializers.ModelSerializer):
    student = UserSummarySerializer(read_only=True)
    teacher = UserSummarySerializer(read_only=True)
    owner = UserSummarySerializer(source='student', read_only=True)
    reviewer = UserSummarySerializer(source='teacher', read_only=True)
    session = SessionListSerializer(read_only=True)
    session_id = serializers.PrimaryKeyRelatedField(
        source='session',
        queryset=Session.objects.all(),
        write_only=True,
        required=True,
    )
    teacher_id = serializers.PrimaryKeyRelatedField(
        source='teacher',
        queryset=User.objects.all(),
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

    class Meta:
        model = ReviewRequest
        fields = [
            'id',
            'session', 'session_id',
            'student',
            'teacher', 'teacher_id',
            'owner', 'reviewer',
            'review_link', 'feedback_link',
            'parent_request', 'parent_request_id',
            'parent_feedback_request',
            'instrument', 'student_level', 'goal', 'exercise_or_song', 'notes',
            'requested_turnaround_hours', 'deadline',
            'status', 'opened_at', 'responded_at', 'viewed_at', 'resubmitted_at', 'closed_at',
            'response_count', 'current_user_role', 'current_member_role', 'feedback_items', 'latest_feedback_at', 'follow_up_request_count', 'feedback_category_counts',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'student', 'teacher', 'owner', 'reviewer', 'session', 'review_link', 'feedback_link', 'parent_request', 'parent_feedback_request',
            'status', 'opened_at', 'responded_at', 'viewed_at', 'resubmitted_at', 'closed_at',
            'response_count', 'current_user_role', 'current_member_role', 'feedback_items', 'latest_feedback_at', 'follow_up_request_count', 'feedback_category_counts',
            'created_at', 'updated_at',
        ]

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
        if user.id == obj.teacher_id:
            return 'teacher'
        if user.id == obj.student_id:
            return 'student'
        return ''

    def get_current_member_role(self, obj):
        legacy = self.get_current_user_role(obj)
        if legacy == 'teacher':
            return 'reviewer'
        if legacy == 'student':
            return 'owner'
        return ''

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

    def validate(self, attrs):
        session = attrs.get('session') or getattr(self.instance, 'session', None)
        teacher = attrs.get('teacher') or getattr(self.instance, 'teacher', None)
        parent_request = attrs.get('parent_request') or getattr(self.instance, 'parent_request', None)
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None

        if not user or not user.is_authenticated:
            raise serializers.ValidationError('Authentication required.')
        if session and session.user_id != user.id and not user.is_staff:
            raise serializers.ValidationError({'session_id': 'You can only request review on your own sessions.'})
        if session and session.processing_status != Session.STATUS_READY:
            raise serializers.ValidationError({'session_id': 'This session must be playback ready before requesting review.'})
        if teacher and teacher.id == user.id:
            raise serializers.ValidationError({'teacher_id': 'Choose a teacher other than yourself.'})
        if parent_request:
            if parent_request.student_id != user.id and not user.is_staff:
                raise serializers.ValidationError({'parent_request_id': 'You can only follow up on your own review requests.'})
            if teacher and parent_request.teacher_id != teacher.id:
                raise serializers.ValidationError({'teacher_id': 'Follow-up requests must use the same teacher as the parent request.'})
            if session and parent_request.session_id == session.id:
                raise serializers.ValidationError({'session_id': 'Choose a new session for this follow-up request.'})
        return attrs


class MemberConnectionSerializer(serializers.ModelSerializer):
    student = UserSummarySerializer(read_only=True)
    member = UserSummarySerializer(source='student', read_only=True)
    pending_review_count = serializers.SerializerMethodField()
    total_review_count = serializers.SerializerMethodField()
    last_request_at = serializers.SerializerMethodField()

    class Meta:
        model = TeacherRosterMembership
        fields = [
            'id', 'student', 'member', 'is_active',
            'pending_review_count', 'total_review_count', 'last_request_at',
            'created_at', 'updated_at',
        ]

    def _teacher(self):
        request = self.context.get('request')
        return getattr(request, 'user', None) if request else None

    def get_pending_review_count(self, obj):
        teacher = self._teacher()
        if not teacher or not teacher.is_authenticated:
            return 0
        return ReviewRequest.objects.filter(
            teacher=teacher,
            student=obj.student,
            status__in=[ReviewRequest.STATUS_REQUESTED, ReviewRequest.STATUS_OPENED],
        ).count()

    def get_total_review_count(self, obj):
        teacher = self._teacher()
        if not teacher or not teacher.is_authenticated:
            return 0
        return ReviewRequest.objects.filter(teacher=teacher, student=obj.student).count()

    def get_last_request_at(self, obj):
        teacher = self._teacher()
        if not teacher or not teacher.is_authenticated:
            return None
        last_request = ReviewRequest.objects.filter(teacher=teacher, student=obj.student).order_by('-created_at').first()
        return last_request.created_at if last_request else None


TeacherRosterStudentSerializer = MemberConnectionSerializer


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
        existing = FeedbackTemplate.objects.filter(teacher=user, title__iexact=title.strip())
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
