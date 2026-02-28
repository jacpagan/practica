from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Profile, Exercise, Session, Chapter, Comment, InviteCode, SessionLastSeen,
    Tag, Space, SpaceMember, FeedbackRequest, FeedbackAssignment,
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

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'display_name', 'spaces']
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
        if not code and not slug:
            raise serializers.ValidationError("An invite code or link is required to sign up.")
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


class FeedbackRequestSerializer(serializers.ModelSerializer):
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    session_title = serializers.CharField(source='session.title', read_only=True)
    requester_name = serializers.SerializerMethodField()
    space_name = serializers.CharField(source='space.name', read_only=True)
    claimed_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()
    video_completed_count = serializers.SerializerMethodField()
    my_assignment_status = serializers.SerializerMethodField()
    my_assignment_id = serializers.SerializerMethodField()
    needs_video_for_final_completion = serializers.SerializerMethodField()

    class Meta:
        model = FeedbackRequest
        fields = [
            'id', 'session_id', 'session_title', 'requester', 'requester_name',
            'space', 'space_name', 'status', 'sla_hours', 'due_at',
            'required_reviews', 'video_required_count', 'focus_prompt',
            'created_at', 'resolved_at',
            'claimed_count', 'completed_count', 'video_completed_count',
            'my_assignment_status', 'my_assignment_id', 'needs_video_for_final_completion',
        ]
        read_only_fields = [
            'id', 'requester', 'created_at', 'resolved_at',
            'claimed_count', 'completed_count', 'video_completed_count',
            'my_assignment_status', 'my_assignment_id', 'needs_video_for_final_completion',
        ]

    def get_requester_name(self, obj):
        if hasattr(obj.requester, 'profile') and obj.requester.profile.display_name:
            return obj.requester.profile.display_name
        return obj.requester.username

    def get_claimed_count(self, obj):
        return obj.assignments.filter(status=FeedbackAssignment.STATUS_CLAIMED).count()

    def get_completed_count(self, obj):
        return obj.assignments.filter(status=FeedbackAssignment.STATUS_COMPLETED).count()

    def get_video_completed_count(self, obj):
        return obj.assignments.filter(
            status=FeedbackAssignment.STATUS_COMPLETED,
            is_video_review=True,
        ).count()

    def _my_assignment(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        return obj.assignments.filter(reviewer=request.user).first()

    def get_my_assignment_status(self, obj):
        assignment = self._my_assignment(obj)
        return assignment.status if assignment else None

    def get_my_assignment_id(self, obj):
        assignment = self._my_assignment(obj)
        return assignment.id if assignment else None

    def get_needs_video_for_final_completion(self, obj):
        completed_count = self.get_completed_count(obj)
        video_count = self.get_video_completed_count(obj)
        remaining_reviews = max(0, obj.required_reviews - completed_count)
        remaining_video_reviews = max(0, obj.video_required_count - video_count)
        return remaining_reviews <= 1 and remaining_video_reviews > 0


class FeedbackAssignmentSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()
    feedback_request = FeedbackRequestSerializer(read_only=True)

    class Meta:
        model = FeedbackAssignment
        fields = [
            'id', 'feedback_request', 'reviewer', 'reviewer_name', 'status',
            'claimed_at', 'completed_at', 'is_video_review',
        ]
        read_only_fields = fields

    def get_reviewer_name(self, obj):
        if hasattr(obj.reviewer, 'profile') and obj.reviewer.profile.display_name:
            return obj.reviewer.profile.display_name
        return obj.reviewer.username


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
    open_feedback_requests = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file',
                  'duration_seconds', 'recorded_at', 'created_at', 'updated_at',
                  'space_id', 'space_name', 'tag_names',
                  'chapters', 'comments', 'chapter_count', 'comment_count', 'owner',
                  'open_feedback_requests']
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

    def get_open_feedback_requests(self, obj):
        requests = obj.feedback_requests.filter(status=FeedbackRequest.STATUS_OPEN).order_by('due_at')
        return FeedbackRequestSerializer(requests, many=True, context=self.context).data


class SessionListSerializer(serializers.ModelSerializer):
    tag_names = serializers.SerializerMethodField()
    space_name = serializers.CharField(source='space.name', read_only=True, default=None)
    space_id = serializers.IntegerField(source='space.id', read_only=True, default=None)
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_id = serializers.IntegerField(source='user.id', read_only=True, default=None)
    has_unread = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ['id', 'title', 'description', 'video_file',
                  'duration_seconds', 'recorded_at', 'created_at',
                  'space_id', 'space_name', 'tag_names',
                  'chapter_count', 'comment_count', 'owner_name', 'owner_id', 'has_unread']
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


class ProgressChapterSerializer(serializers.ModelSerializer):
    session_title = serializers.CharField(source='session.title', read_only=True)
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    session_video = serializers.FileField(source='session.video_file', read_only=True)
    session_date = serializers.DateTimeField(source='session.recorded_at', read_only=True)

    class Meta:
        model = Chapter
        fields = ['id', 'timestamp_seconds', 'end_seconds', 'notes',
                  'session_id', 'session_title', 'session_video', 'session_date', 'created_at']
