import secrets
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from videos.media.api import SessionMediaActionsMixin
from videos.media.services import maybe_refresh_session_processing, normalized_client_upload_id, start_processing_pipeline
from videos.media.uploads import attach_tags_to_session, parse_tag_names
from videos.models import Chapter, Exercise, ReviewLink, Session, SessionAsset, SessionLastSeen, Tag, VideoFeedback
from videos.serializers import ChapterSerializer, ReviewLinkSerializer, ReviewVideoFeedbackSerializer, SessionListSerializer, SessionSerializer
from videos.services.feedback_video_processing import prepare_feedback_video_upload
from videos.video_uploads import is_allowed_video_upload


def visible_sessions_qs(user):
    if not user.is_authenticated:
        return Session.objects.none()
    return Session.objects.filter(user=user)


def can_edit_session(user, session):
    if not user.is_authenticated:
        return False
    return user.is_staff or session.user_id == user.id


def can_view_session(user, session):
    if not user.is_authenticated:
        return False
    return user.is_staff or session.user_id == user.id


def can_modify_session(user, session):
    return can_edit_session(user, session)


@method_decorator(csrf_exempt, name='dispatch')
class SessionViewSet(SessionMediaActionsMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = visible_sessions_qs(self.request.user).prefetch_related(
            'chapters', 'chapters__exercise',
            'video_feedback', 'video_feedback__user', 'video_feedback__user__profile',
            'last_seen_by', 'tags', 'assets',
        ).select_related('user', 'user__profile')

        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__name__iexact=tag)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date or end_date:
            if start_date and end_date:
                qs = qs.filter(recorded_at__date__range=(start_date, end_date))
            elif start_date:
                qs = qs.filter(recorded_at__date__gte=start_date)
            elif end_date:
                qs = qs.filter(recorded_at__date__lte=end_date)

        return qs.distinct()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_serializer_class(self):
        if self.action == 'list':
            return SessionListSerializer
        return SessionSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        processing_sessions = list(queryset.filter(processing_status=Session.STATUS_PROCESSING).exclude(processing_job_id='')[:5])
        for session in processing_sessions:
            maybe_refresh_session_processing(session)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        maybe_refresh_session_processing(instance)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        session = serializer.save(user=self.request.user)
        attach_tags_to_session(session, self.request.data.get('tags', ''))
        start_processing_pipeline(session)

    def perform_update(self, serializer):
        if not can_edit_session(self.request.user, serializer.instance):
            raise PermissionDenied("You can only edit your own sessions.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_edit_session(self.request.user, instance):
            raise PermissionDenied("You can only delete your own sessions.")
        instance.delete()

    @action(detail=True, methods=['post', 'delete'], url_path='share')
    def create_share_link(self, request, pk=None):
        session = self.get_object()
        maybe_refresh_session_processing(session)
        session.refresh_from_db()
        if request.method == 'DELETE':
            if not can_edit_session(request.user, session):
                raise PermissionDenied("You can only revoke your own sessions' links.")
            ReviewLink.objects.filter(session=session, is_active=True).update(is_active=False)
            return Response({'ok': True})

        if not can_edit_session(request.user, session):
            raise PermissionDenied("You can only share your own sessions.")
        if session.processing_status != Session.STATUS_READY:
            return Response(
                {'error': 'This video must be playback ready before you can share a private feedback link.'},
                status=status.HTTP_409_CONFLICT,
            )
        existing_link = session.review_links.filter(is_active=True, expires_at__gt=timezone.now()).order_by('-created_at').first()
        if existing_link:
            return Response(ReviewLinkSerializer(existing_link, context={'request': request}).data, status=status.HTTP_200_OK)
        link = ReviewLink.objects.create(
            session=session,
            token=secrets.token_urlsafe(16),
            created_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        return Response(ReviewLinkSerializer(link, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='share/revoke')
    def revoke_share_link(self, request, pk=None):
        session = self.get_object()
        if not can_edit_session(request.user, session):
            raise PermissionDenied("You can only revoke your own sessions' links.")
        ReviewLink.objects.filter(session=session, is_active=True).update(is_active=False)
        return Response({'ok': True})

    @action(detail=True, methods=['post'], url_path='retry-processing')
    def retry_processing(self, request, pk=None):
        session = self.get_object()
        if not can_edit_session(request.user, session):
            raise PermissionDenied("You can only reprocess your own sessions.")

        session.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4).delete()
        start_processing_pipeline(session)
        session.refresh_from_db()
        serializer = self.get_serializer(session)
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def set_tags(self, request, pk=None):
        session = self.get_object()
        if not can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        tag_names = request.data.get('tags', [])
        if isinstance(tag_names, str):
            tag_names = parse_tag_names(tag_names)
        session.tags.clear()
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
            session.tags.add(tag)
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def add_chapter(self, request, pk=None):
        session = self.get_object()
        if not can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        exercise_name = request.data.get('exercise_name', '').strip()
        exercise_id = request.data.get('exercise')
        exercise = None
        if exercise_id:
            exercise = get_object_or_404(Exercise, pk=exercise_id)
        elif exercise_name:
            exercise, _ = Exercise.objects.get_or_create(name__iexact=exercise_name, defaults={'name': exercise_name})
        ts = request.data.get('timestamp_seconds', 0)
        end = request.data.get('end_seconds')
        try:
            ts = max(0, int(ts))
        except (ValueError, TypeError):
            ts = 0
        if end is not None and str(end).strip():
            try:
                end = int(end)
                if end <= ts:
                    return Response({'error': 'End time must be after start time'}, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                end = None
        else:
            end = None
        serializer = ChapterSerializer(data={
            'session': session.id, 'exercise': exercise.id if exercise else None,
            'title': request.data.get('title', ''), 'timestamp_seconds': ts,
            'end_seconds': end, 'notes': request.data.get('notes', ''),
        })
        if serializer.is_valid():
            serializer.save()
            session.refresh_from_db()
            return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='chapters/(?P<chapter_id>[0-9]+)/update')
    def update_chapter(self, request, pk=None, chapter_id=None):
        session = self.get_object()
        if not can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        chapter = get_object_or_404(Chapter, pk=chapter_id, session=session)

        exercise_name = request.data.get('exercise_name', '').strip()
        if exercise_name:
            exercise, _ = Exercise.objects.get_or_create(name__iexact=exercise_name, defaults={'name': exercise_name})
            chapter.exercise = exercise

        if 'notes' in request.data:
            chapter.notes = request.data['notes'].strip()
        if 'timestamp_seconds' in request.data:
            try:
                chapter.timestamp_seconds = max(0, int(request.data['timestamp_seconds']))
            except (ValueError, TypeError):
                pass
        if 'end_seconds' in request.data:
            end = request.data['end_seconds']
            if end is not None and str(end).strip():
                try:
                    end = int(end)
                    if end > chapter.timestamp_seconds:
                        chapter.end_seconds = end
                except (ValueError, TypeError):
                    pass
            else:
                chapter.end_seconds = None

        chapter.save()
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['delete'], url_path='chapters/(?P<chapter_id>[0-9]+)')
    def remove_chapter(self, request, pk=None, chapter_id=None):
        session = self.get_object()
        if not can_modify_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        chapter = get_object_or_404(Chapter, pk=chapter_id, session=session)
        chapter.delete()
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)

    @action(detail=True, methods=['post'], url_path='video-feedback')
    def add_video_feedback(self, request, pk=None):
        session = self.get_object()
        if not can_view_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        video_file = request.FILES.get('feedback_video')
        text = request.data.get('text', '').strip()
        try:
            timestamp = int(request.data.get('timestamp_seconds', 0) or 0)
            if timestamp < 0:
                timestamp = 0
        except (ValueError, TypeError):
            timestamp = 0
        if not video_file:
            return Response({'error': 'Feedback video is required'}, status=status.HTTP_400_BAD_REQUEST)
        if video_file and not is_allowed_video_upload(video_file.content_type, video_file.name):
            return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)
        client_upload_id = normalized_client_upload_id(request.data.get('client_upload_id'))
        try:
            video_file = prepare_feedback_video_upload(video_file)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if client_upload_id:
            existing = VideoFeedback.objects.filter(
                session=session,
                user=request.user,
                review_request__isnull=True,
                client_upload_id=client_upload_id,
            ).first()
            if existing:
                session.refresh_from_db()
                return Response(SessionSerializer(session).data, status=status.HTTP_200_OK)
        VideoFeedback.objects.create(
            session=session, user=request.user,
            timestamp_seconds=timestamp, text=text, feedback_video=video_file, client_upload_id=client_upload_id, is_legacy_text_feedback=False,
        )
        session.refresh_from_db()
        return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_seen(self, request, pk=None):
        session = self.get_object()
        SessionLastSeen.objects.update_or_create(
            user=request.user, session=session,
            defaults={'seen_at': timezone.now()},
        )
        return Response({'status': 'ok'})

    @action(detail=True, methods=['patch', 'delete'], url_path='video-feedback/(?P<feedback_id>[0-9]+)')
    def manage_video_feedback(self, request, pk=None, feedback_id=None):
        session = self.get_object()
        if not can_view_session(request.user, session):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        feedback = get_object_or_404(VideoFeedback, pk=feedback_id, session=session)
        if request.user != feedback.user and not request.user.is_staff:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if request.method == 'PATCH':
            payload = request.data.copy()
            if str(payload.get('timestamp_seconds', '')).strip() == '':
                payload['timestamp_seconds'] = None

            serializer = ReviewVideoFeedbackSerializer(
                feedback,
                data=payload,
                partial=True,
                context={'request': request, 'session': session},
            )
            serializer.is_valid(raise_exception=True)

            next_timestamp = serializer.validated_data.get('timestamp_seconds', feedback.timestamp_seconds)
            if 'timestamp_seconds' in request.data and str(request.data.get('timestamp_seconds', '')).strip() == '':
                next_timestamp = None

            next_video = feedback.feedback_video
            if 'feedback_video' in request.FILES:
                uploaded_video = request.FILES.get('feedback_video')
                if uploaded_video and not is_allowed_video_upload(uploaded_video.content_type, uploaded_video.name):
                    return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    next_video = prepare_feedback_video_upload(uploaded_video)
                except ValueError as exc:
                    return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            if not next_video and not feedback.is_legacy_text_feedback:
                return Response({'error': 'Feedback video is required'}, status=status.HTTP_400_BAD_REQUEST)

            if 'text' in request.data:
                feedback.text = str(request.data.get('text', '') or '').strip()
            feedback.feedback_category = serializer.validated_data.get('feedback_category', feedback.feedback_category)
            feedback.timestamp_seconds = next_timestamp
            if 'feedback_video' in request.FILES:
                if feedback.feedback_video:
                    feedback.feedback_video.delete(save=False)
                feedback.feedback_video = next_video
            feedback.is_legacy_text_feedback = False if feedback.feedback_video else feedback.is_legacy_text_feedback
            feedback.save()
            session.refresh_from_db()
            return Response(SessionSerializer(session, context={'request': request}).data)

        feedback.delete()
        session.refresh_from_db()
        return Response(SessionSerializer(session, context={'request': request}).data)
