from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.core.files.storage import default_storage
from rest_framework import serializers
from .models import (
    Profile, Session, Chapter, VideoFeedback,
    SessionAsset,
    ReviewLink,
)


KNOWN_VIDEO_EXTENSIONS = ('mov', 'mp4', 'm4v', 'webm', 'avi', 'mkv', 'mpeg', 'mpg', 'wmv', '3gp')


def _filename_has_video_extension(filename):
    name = str(filename or '').strip().lower()
    return any(name.endswith(f'.{extension}') for extension in KNOWN_VIDEO_EXTENSIONS)


def _is_allowed_video_upload(file_obj):
    content_type = str(getattr(file_obj, 'content_type', '') or '').strip().lower()
    filename = str(getattr(file_obj, 'name', '') or '').strip()
    if content_type.startswith('video/'):
        return True
    if content_type in {'application/octet-stream', 'binary/octet-stream', ''} and _filename_has_video_extension(filename):
        return True
    return False


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


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    display_name = serializers.CharField(max_length=100, required=False, default='')

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        Profile.objects.create(
            user=user,
            display_name=validated_data.get('display_name', ''),
        )

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

    class Meta:
        model = VideoFeedback
        fields = ['id', 'session', 'user', 'username', 'display_name',
                  'timestamp_seconds', 'text', 'feedback_video', 'created_at']
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
    processing_status = serializers.CharField(read_only=True)
    processing_error = serializers.CharField(read_only=True)
    assets = SessionAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file',
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
        if value and not _is_allowed_video_upload(value):
            raise serializers.ValidationError('Only video files allowed.')
        return value

class SessionListSerializer(serializers.ModelSerializer):
    video_feedback_count = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    processing_status = serializers.CharField(read_only=True)
    processing_error = serializers.CharField(read_only=True)
    assets = SessionAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file',
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
    assets = SessionAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file', 'duration_seconds', 'recorded_at', 'assets', 'processing_status', 'processing_error']
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

    class Meta:
        model = VideoFeedback
        fields = [
            'id', 'author_display_name', 'authored_by_current_user',
            'timestamp_seconds', 'text', 'feedback_video', 'created_at',
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
