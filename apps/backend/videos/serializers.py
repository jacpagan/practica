from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Profile, Exercise, Session, Chapter, Comment, TeacherStudent, InviteCode


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

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def create(self, validated_data):
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


class SessionSerializer(serializers.ModelSerializer):
    chapters = ChapterSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'title', 'description', 'video_file',
            'duration_seconds', 'recorded_at', 'created_at', 'updated_at',
            'chapters', 'comments', 'chapter_count', 'comment_count', 'owner',
        ]
        read_only_fields = ['id', 'recorded_at', 'created_at', 'updated_at']

    def get_chapter_count(self, obj):
        return obj.chapters.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_owner(self, obj):
        if obj.user:
            return UserSerializer(obj.user).data
        return None


class SessionListSerializer(serializers.ModelSerializer):
    chapter_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'title', 'description', 'video_file',
            'duration_seconds', 'recorded_at', 'created_at',
            'chapter_count', 'comment_count', 'owner_name',
        ]
        read_only_fields = ['id', 'recorded_at', 'created_at']

    def get_chapter_count(self, obj):
        return obj.chapters.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_owner_name(self, obj):
        if obj.user and hasattr(obj.user, 'profile') and obj.user.profile.display_name:
            return obj.user.profile.display_name
        return obj.user.username if obj.user else None


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
