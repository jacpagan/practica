from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers
from urllib.parse import parse_qs, urlencode, urlparse
import re
from .models import (
    Profile, Exercise, Session, Chapter, Comment, InviteCode, SessionLastSeen,
    Tag, Space, SpaceMember, ExerciseReferenceClip,
)


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['display_name']


class SpaceSerializer(serializers.ModelSerializer):
    session_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    invite_link = serializers.SerializerMethodField()

    class Meta:
        model = Space
        fields = ['id', 'name', 'invite_slug', 'session_count', 'members', 'is_owner', 'invite_link', 'created_at']
        read_only_fields = ['id', 'invite_slug', 'created_at']

    def get_session_count(self, obj):
        return obj.sessions.count()

    def get_members(self, obj):
        return [{
            'id': m.user.id,
            'display_name': m.user.profile.display_name if hasattr(m.user, 'profile') and m.user.profile.display_name else m.user.username,
        } for m in obj.members.select_related('user', 'user__profile').all()]

    def get_is_owner(self, obj):
        request = self.context.get('request')
        return request and request.user == obj.owner

    def get_invite_link(self, obj):
        return f"/join/{obj.invite_slug}"


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    spaces = serializers.SerializerMethodField()
    has_spaces = serializers.SerializerMethodField()
    joined_spaces_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'display_name',
            'spaces',
            'has_spaces',
            'joined_spaces_count',
        ]
        read_only_fields = ['id']

    def get_display_name(self, obj):
        if hasattr(obj, 'profile') and obj.profile.display_name:
            return obj.profile.display_name
        return obj.username

    def get_spaces(self, obj):
        owned = [{'id': s.id, 'name': s.name, 'role': 'owner'} for s in obj.owned_spaces.all()]
        following = [{'id': m.space.id, 'name': m.space.name, 'role': 'viewer'}
                     for m in obj.space_memberships.select_related('space').all()]
        return owned + following

    def get_has_spaces(self, obj):
        return obj.owned_spaces.exists() or obj.space_memberships.exists()

    def get_joined_spaces_count(self, obj):
        return obj.space_memberships.count()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=6)
    display_name = serializers.CharField(max_length=100, required=False, default='')
    invite_code = serializers.CharField(max_length=8, required=False, default='')
    invite_slug = serializers.CharField(max_length=20, required=False, default='')

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate(self, data):
        code = data.get('invite_code', '').strip().upper()
        slug = data.get('invite_slug', '').strip()
        if code:
            if not InviteCode.objects.filter(code=code, used_by__isnull=True).exists():
                raise serializers.ValidationError({'invite_code': "Invalid or already used invite code."})
        if slug:
            if not Space.objects.filter(invite_slug=slug).exists():
                raise serializers.ValidationError({'invite_slug': "Invalid invite link."})
        return data

    def create(self, validated_data):
        code = validated_data.pop('invite_code', '').strip().upper()
        slug = validated_data.pop('invite_slug', '').strip()

        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        Profile.objects.create(
            user=user,
            display_name=validated_data.get('display_name', ''),
        )

        # Handle invite code
        if code:
            try:
                invite = InviteCode.objects.get(code=code, used_by__isnull=True)
                invite.used_by = user
                invite.used_at = timezone.now()
                invite.save()
                if invite.space:
                    SpaceMember.objects.get_or_create(space=invite.space, user=user)
            except InviteCode.DoesNotExist:
                pass

        # Handle invite slug (permanent link)
        if slug:
            try:
                space = Space.objects.get(invite_slug=slug)
                SpaceMember.objects.get_or_create(space=space, user=user)
            except Space.DoesNotExist:
                pass

        return user


class ExerciseSerializer(serializers.ModelSerializer):
    chapter_count = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ['id', 'name', 'category', 'description', 'created_at', 'chapter_count']
        read_only_fields = ['id', 'created_at', 'chapter_count']

    def get_chapter_count(self, obj):
        return obj.chapters.count()


class ExerciseReferenceClipSerializer(serializers.ModelSerializer):
    embed_url = serializers.SerializerMethodField()
    watch_url_with_start = serializers.SerializerMethodField()

    class Meta:
        model = ExerciseReferenceClip
        fields = [
            'id', 'exercise', 'title', 'youtube_url', 'youtube_video_id', 'youtube_playlist_id',
            'start_seconds', 'end_seconds', 'notes', 'created_at', 'updated_at',
            'embed_url', 'watch_url_with_start',
        ]
        read_only_fields = [
            'id', 'exercise', 'youtube_video_id', 'youtube_playlist_id',
            'created_at', 'updated_at', 'embed_url', 'watch_url_with_start',
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        current_start = self.instance.start_seconds if self.instance else 0
        current_end = self.instance.end_seconds if self.instance else None

        start_seconds = attrs.get('start_seconds', current_start)
        end_seconds = attrs.get('end_seconds', current_end)
        if start_seconds < 0:
            raise serializers.ValidationError({'start_seconds': 'Start must be 0 or greater.'})
        if end_seconds is not None and end_seconds <= start_seconds:
            raise serializers.ValidationError({'end_seconds': 'End must be greater than start.'})

        if 'youtube_url' in attrs:
            parsed = self._parse_youtube_url(attrs['youtube_url'])
            attrs['youtube_video_id'] = parsed['video_id']
            attrs['youtube_playlist_id'] = parsed['playlist_id']
            query = {'v': parsed['video_id']}
            if parsed['playlist_id']:
                query['list'] = parsed['playlist_id']
            attrs['youtube_url'] = f"https://www.youtube.com/watch?{urlencode(query)}"

        return attrs

    def _parse_youtube_url(self, value):
        raw = (value or '').strip()
        if not raw:
            raise serializers.ValidationError({'youtube_url': 'YouTube URL is required.'})
        parsed = urlparse(raw)
        if parsed.scheme not in ('http', 'https'):
            raise serializers.ValidationError({'youtube_url': 'YouTube URL must include http:// or https://.'})
        host = (parsed.netloc or '').lower()
        path = parsed.path or ''
        query = parse_qs(parsed.query or '')
        video_id = None
        playlist_id = ''

        if host in ('youtube.com', 'www.youtube.com', 'm.youtube.com'):
            if path != '/watch':
                raise serializers.ValidationError({'youtube_url': 'Use a YouTube watch URL with v=VIDEO_ID.'})
            video_id = (query.get('v') or [None])[0]
            playlist_id = ((query.get('list') or [''])[0] or '').strip()
        elif host == 'youtu.be':
            video_id = path.lstrip('/').split('/')[0] if path else None
            playlist_id = ((query.get('list') or [''])[0] or '').strip()
        else:
            raise serializers.ValidationError({'youtube_url': 'Only youtube.com or youtu.be URLs are supported.'})

        if not video_id or not re.match(r'^[A-Za-z0-9_-]{11}$', video_id):
            raise serializers.ValidationError({'youtube_url': 'Could not detect a valid YouTube video id.'})

        return {'video_id': video_id, 'playlist_id': playlist_id}

    def get_embed_url(self, obj):
        params = {'start': int(obj.start_seconds or 0)}
        if obj.end_seconds is not None:
            params['end'] = int(obj.end_seconds)
        return f"https://www.youtube.com/embed/{obj.youtube_video_id}?{urlencode(params)}"

    def get_watch_url_with_start(self, obj):
        params = {'v': obj.youtube_video_id, 't': f"{int(obj.start_seconds or 0)}s"}
        if obj.youtube_playlist_id:
            params['list'] = obj.youtube_playlist_id
        return f"https://www.youtube.com/watch?{urlencode(params)}"


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'session', 'user', 'username', 'display_name',
                  'timestamp_seconds', 'text', 'video_reply', 'created_at']
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


class TagSerializer(serializers.ModelSerializer):
    session_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ['id', 'name', 'session_count']
        read_only_fields = ['id']

    def get_session_count(self, obj):
        return obj.sessions.count()


class SessionSerializer(serializers.ModelSerializer):
    chapters = ChapterSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    tag_names = serializers.SerializerMethodField()
    space_name = serializers.CharField(source='space.name', read_only=True, default=None)
    space_id = serializers.IntegerField(source='space.id', read_only=True, default=None)
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file',
                  'duration_seconds', 'recorded_at', 'created_at', 'updated_at',
                  'space_id', 'space_name', 'tag_names',
                  'chapters', 'comments', 'chapter_count', 'comment_count', 'owner',
                  'can_edit']
        read_only_fields = ['id', 'recorded_at', 'created_at', 'updated_at']

    def get_tag_names(self, obj):
        return [t.name for t in obj.tags.all()]

    def get_chapter_count(self, obj):
        return obj.chapters.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

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


class SessionListSerializer(serializers.ModelSerializer):
    tag_names = serializers.SerializerMethodField()
    space_name = serializers.CharField(source='space.name', read_only=True, default=None)
    space_id = serializers.IntegerField(source='space.id', read_only=True, default=None)
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_id = serializers.IntegerField(source='user.id', read_only=True, default=None)
    has_unread = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file',
                  'duration_seconds', 'recorded_at', 'created_at',
                  'space_id', 'space_name', 'tag_names',
                  'chapter_count', 'comment_count', 'owner_name', 'owner_id', 'has_unread',
                  'can_edit']
        read_only_fields = ['id', 'recorded_at', 'created_at']

    def get_tag_names(self, obj):
        return [t.name for t in obj.tags.all()]

    def get_chapter_count(self, obj):
        return obj.chapters.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_owner_name(self, obj):
        if obj.user and hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username if obj.user else None

    def get_has_unread(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        comments = obj.comments.all()
        if not comments:
            return False
        latest_comment = max(c.created_at for c in comments)
        try:
            last_seen = obj.last_seen_by.get(user=request.user)
            return latest_comment > last_seen.seen_at
        except SessionLastSeen.DoesNotExist:
            return True

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


class ProgressChapterSerializer(serializers.ModelSerializer):
    session_title = serializers.CharField(source='session.title', read_only=True)
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    session_video = serializers.FileField(source='session.video_file', read_only=True)
    session_date = serializers.DateTimeField(source='session.recorded_at', read_only=True)

    class Meta:
        model = Chapter
        fields = ['id', 'timestamp_seconds', 'end_seconds', 'notes',
                  'session_id', 'session_title', 'session_video', 'session_date', 'created_at']
