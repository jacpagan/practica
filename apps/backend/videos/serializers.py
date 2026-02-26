from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers
from .models import Profile, Exercise, Session, Chapter, Comment, TeacherStudent, InviteCode, SessionLastSeen, Tag


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['role', 'display_name']


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    role = serializers.CharField(source='profile.role', read_only=True)
    display_name = serializers.SerializerMethodField()
    linked_teachers = serializers.SerializerMethodField()
    linked_students = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile', 'role', 'display_name',
                  'linked_teachers', 'linked_students']
        read_only_fields = ['id']

    def get_display_name(self, obj):
        if hasattr(obj, 'profile') and obj.profile.display_name:
            return obj.profile.display_name
        return obj.username

    def get_linked_teachers(self, obj):
        links = TeacherStudent.objects.filter(student=obj).select_related('teacher', 'teacher__profile')
        return [_linked_user_data(link.teacher) for link in links]

    def get_linked_students(self, obj):
        links = TeacherStudent.objects.filter(teacher=obj).select_related('student', 'student__profile')
        return [_linked_user_data(link.student) for link in links]


def _linked_user_data(user):
    name = user.username
    if hasattr(user, 'profile') and user.profile.display_name:
        name = user.profile.display_name
    role = user.profile.role if hasattr(user, 'profile') else 'student'
    return {'id': user.id, 'username': user.username, 'display_name': name, 'role': role}


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, default='')
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=['student', 'teacher'], default='student')
    display_name = serializers.CharField(max_length=100, required=False, default='')
    invite_code = serializers.CharField(max_length=8)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_invite_code(self, value):
        code = value.strip().upper()
        try:
            invite = InviteCode.objects.get(code=code, used_by__isnull=True)
        except InviteCode.DoesNotExist:
            raise serializers.ValidationError("Invalid or already used invite code.")
        return code

    def create(self, validated_data):
        code = validated_data.pop('invite_code').strip().upper()
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        Profile.objects.create(
            user=user,
            role=validated_data.get('role', 'student'),
            display_name=validated_data.get('display_name', ''),
        )

        # Mark invite as used and auto-link teacher/student
        invite = InviteCode.objects.get(code=code, used_by__isnull=True)
        invite.used_by = user
        invite.used_at = timezone.now()
        invite.save()

        creator = invite.created_by
        creator_role = creator.profile.role if hasattr(creator, 'profile') else 'student'
        new_role = validated_data.get('role', 'student')

        if creator_role != new_role:
            teacher = creator if creator_role == 'teacher' else user
            student = user if creator_role == 'teacher' else creator
            TeacherStudent.objects.get_or_create(teacher=teacher, student=student)

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
    role = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'session', 'user', 'username', 'display_name', 'role',
            'timestamp_seconds', 'text', 'video_reply', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'username', 'display_name', 'role', 'created_at']

    def get_display_name(self, obj):
        if hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username

    def get_role(self, obj):
        if hasattr(obj.user, 'profile'):
            return obj.user.profile.role
        return 'student'


class ChapterSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source='exercise.name', read_only=True, default=None)

    class Meta:
        model = Chapter
        fields = [
            'id', 'session', 'exercise', 'exercise_name',
            'title', 'timestamp_seconds', 'end_seconds', 'notes', 'created_at',
        ]
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
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'title', 'description', 'video_file',
            'duration_seconds', 'recorded_at', 'created_at', 'updated_at',
            'tag_names', 'chapters', 'comments', 'chapter_count', 'comment_count', 'owner',
        ]
        read_only_fields = ['id', 'recorded_at', 'created_at', 'updated_at']

    def get_tag_names(self, obj):
        return [t.name for t in obj.tags.all()]

    def get_chapter_count(self, obj):
        return obj.chapters.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_owner(self, obj):
        if obj.user:
            return UserSerializer(obj.user).data
        return None


class SessionListSerializer(serializers.ModelSerializer):
    tag_names = serializers.SerializerMethodField()
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    has_unread = serializers.SerializerMethodField()
    last_comment_at = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'title', 'description', 'video_file',
            'duration_seconds', 'recorded_at', 'created_at',
            'tag_names', 'chapter_count', 'comment_count', 'owner_name',
            'has_unread', 'last_comment_at',
        ]
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

    def get_last_comment_at(self, obj):
        comments = obj.comments.all()
        if not comments:
            return None
        return max(c.created_at for c in comments).isoformat()


class ProgressChapterSerializer(serializers.ModelSerializer):
    session_title = serializers.CharField(source='session.title', read_only=True)
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    session_video = serializers.FileField(source='session.video_file', read_only=True)
    session_date = serializers.DateTimeField(source='session.recorded_at', read_only=True)

    class Meta:
        model = Chapter
        fields = [
            'id', 'timestamp_seconds', 'end_seconds', 'notes',
            'session_id', 'session_title', 'session_video', 'session_date', 'created_at',
        ]
