from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from videos.models import FeedbackTemplate, ReviewLink, ReviewRequest, ReviewerRosterMembership, VideoFeedback
from videos.reviews.presentation import public_review_request_preview, review_request_forbidden_response
from videos.reviews.queries import filter_review_requests_for_role, review_request_visible_to_user, reviewer_can_respond, visible_review_requests_qs
from videos.reviews.services import create_review_request, mark_review_request_viewed, transition_review_request_status
from videos.serializers import FeedbackTemplateSerializer, MemberConnectionSerializer, PublicSessionSerializer, ReviewLinkSerializer, ReviewRequestSerializer, ReviewVideoFeedbackSerializer, UserSummarySerializer
from videos.services.feedback_video_processing import prepare_feedback_video_upload
from videos.video_uploads import is_allowed_video_upload


REVIEW_LINK_ERROR_DETAILS = {
    'invalid': {
        'status': status.HTTP_404_NOT_FOUND,
        'code': 'review_link_invalid',
        'error': 'This private feedback link does not exist.',
    },
    'expired': {
        'status': status.HTTP_410_GONE,
        'code': 'review_link_expired',
        'error': 'This private feedback link has expired.',
    },
    'revoked': {
        'status': status.HTTP_403_FORBIDDEN,
        'code': 'review_link_revoked',
        'error': 'This private feedback link has been turned off.',
    },
}


def _resolve_review_link(token):
    normalized_token = str(token or '').strip()
    if not normalized_token:
        return None, 'invalid'

    link = ReviewLink.objects.select_related(
        'session',
        'session__user',
        'session__user__profile',
    ).filter(token=normalized_token).first()
    if not link:
        return None, 'invalid'
    if not link.is_active:
        return None, 'revoked'
    if link.expires_at <= timezone.now():
        return None, 'expired'
    return link, None


def _review_link_error_response(reason):
    details = REVIEW_LINK_ERROR_DETAILS.get(reason, REVIEW_LINK_ERROR_DETAILS['invalid'])
    return Response(
        {
            'error': details['error'],
            'code': details['code'],
        },
        status=details['status'],
    )


def _normalized_client_upload_id(raw_value):
    value = str(raw_value or '').strip()
    return value[:64]


@csrf_exempt
@api_view(['GET'])
@permission_classes([AllowAny])
def review_link_info(request, token):
    link, error_reason = _resolve_review_link(token)
    if error_reason:
        return _review_link_error_response(error_reason)
    review_request = getattr(link, 'review_request', None)
    if request.user.is_authenticated and review_request and not review_request_visible_to_user(review_request, request.user):
        return review_request_forbidden_response(
            'This review request is only available to the assigned reviewer and owner.'
        )
    ReviewLink.objects.filter(pk=link.pk).update(last_accessed_at=timezone.now())
    link.refresh_from_db(fields=['last_accessed_at'])
    if request.user.is_authenticated and review_request and review_request.status == ReviewRequest.STATUS_REQUESTED and request.user.id == review_request.reviewer_id:
        review_request.status = ReviewRequest.STATUS_OPENED
        review_request.opened_at = timezone.now()
        review_request.save(update_fields=['status', 'opened_at', 'updated_at'])
    elif request.user.is_authenticated and review_request and request.user.id == review_request.student_id:
        if review_request.status == ReviewRequest.STATUS_RESPONDED:
            mark_review_request_viewed(review_request=review_request, actor=request.user)
            review_request.refresh_from_db()
    if request.user.is_authenticated:
        request_payload = ReviewRequestSerializer(review_request, context={'request': request}).data if review_request else None
    else:
        request_payload = public_review_request_preview(review_request)
    return Response({
        'session': PublicSessionSerializer(link.session, context={'request': request}).data,
        'link': ReviewLinkSerializer(link, context={'request': request}).data,
        'auth_required': True,
        'review_request': request_payload,
        'feedback_request': request_payload,
    })


@csrf_exempt
@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def review_link_feedback(request, token):
    link, error_reason = _resolve_review_link(token)
    if error_reason:
        return _review_link_error_response(error_reason)
    review_request = getattr(link, 'review_request', None)
    if review_request and not review_request_visible_to_user(review_request, request.user):
        return review_request_forbidden_response(
            'This review request is only available to the assigned reviewer and owner.'
        )

    if request.method == 'GET':
        feedback = link.session.video_feedback.select_related('user', 'user__profile')
        if review_request:
            feedback = feedback.filter(review_request=review_request)
        feedback = feedback.order_by('timestamp_seconds', 'created_at')
        return Response(ReviewVideoFeedbackSerializer(feedback, many=True, context={'request': request, 'session': link.session}).data)

    if request.method in {'PATCH', 'DELETE'}:
        raw_feedback_id = request.data.get('feedback_id') or request.query_params.get('feedback_id')
        try:
            feedback_id = int(raw_feedback_id)
        except (TypeError, ValueError):
            return Response({'error': 'feedback_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        feedback = get_object_or_404(VideoFeedback, pk=feedback_id, session=link.session)
        if review_request and feedback.review_request_id != review_request.id:
            return Response({'error': 'Feedback not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.user != feedback.user and not request.user.is_staff:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'DELETE':
            feedback.delete()
            return Response({'ok': True})

        payload = request.data.copy()
        if str(payload.get('timestamp_seconds', '')).strip() == '':
            payload['timestamp_seconds'] = None

        serializer = ReviewVideoFeedbackSerializer(
            feedback,
            data=payload,
            partial=True,
            context={'request': request, 'session': link.session},
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

        if not next_video:
            return Response({'error': 'Feedback video is required'}, status=status.HTTP_400_BAD_REQUEST)

        if 'text' in request.data:
            feedback.text = str(request.data.get('text', '') or '').strip()
        feedback.feedback_category = serializer.validated_data.get('feedback_category', feedback.feedback_category)
        feedback.timestamp_seconds = next_timestamp
        if 'feedback_video' in request.FILES:
            if feedback.feedback_video:
                feedback.feedback_video.delete(save=False)
            feedback.feedback_video = next_video
        feedback.is_legacy_text_feedback = False
        feedback.save()

        return Response(ReviewVideoFeedbackSerializer(feedback, context={'request': request, 'session': link.session}).data)

    if not link.allow_video_feedback:
        return Response(
            {
                'error': 'Video feedback is disabled for this link',
                'code': 'review_link_feedback_disabled',
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    if review_request and not reviewer_can_respond(review_request, request.user):
        return review_request_forbidden_response(
            'Only the assigned reviewer can respond to this review request.'
        )

    serializer = ReviewVideoFeedbackSerializer(data=request.data, context={'request': request, 'session': link.session})
    serializer.is_valid(raise_exception=True)
    video_file = request.FILES.get('feedback_video')
    text = str(request.data.get('text', '') or '').strip()
    client_upload_id = _normalized_client_upload_id(request.data.get('client_upload_id'))
    if not video_file:
        return Response({'error': 'Feedback video is required'}, status=status.HTTP_400_BAD_REQUEST)
    if video_file and not is_allowed_video_upload(video_file.content_type, video_file.name):
        return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        video_file = prepare_feedback_video_upload(video_file)
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if client_upload_id:
        existing = VideoFeedback.objects.filter(
            session=link.session,
            review_request=review_request,
            user=request.user,
            client_upload_id=client_upload_id,
        ).first()
        if existing:
            return Response(
                ReviewVideoFeedbackSerializer(existing, context={'request': request, 'session': link.session}).data,
                status=status.HTTP_200_OK,
            )

    item = VideoFeedback.objects.create(
        session=link.session,
        review_request=review_request,
        user=request.user,
        feedback_category=serializer.validated_data.get('feedback_category', ''),
        timestamp_seconds=serializer.validated_data.get('timestamp_seconds'),
        text=text,
        feedback_video=video_file,
        client_upload_id=client_upload_id,
        is_legacy_text_feedback=False,
    )
    if review_request:
        review_request.status = ReviewRequest.STATUS_RESPONDED
        review_request.responded_at = timezone.now()
        review_request.save(update_fields=['status', 'responded_at', 'updated_at'])
    return Response(
        ReviewVideoFeedbackSerializer(item, context={'request': request, 'session': link.session}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_inbox(request):
    qs = ReviewRequest.objects.filter(reviewer=request.user).select_related(
        'student', 'student__profile', 'reviewer', 'reviewer__profile', 'session', 'review_link'
    ).order_by('-created_at')
    status_filter = str(request.query_params.get('status', '')).strip().lower()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(ReviewRequestSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def member_connections(request):
    memberships = ReviewerRosterMembership.objects.filter(reviewer=request.user, is_active=True).select_related(
        'student', 'student__profile'
    ).order_by('student__username')
    return Response(MemberConnectionSerializer(memberships, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_insights(request):
    review_requests = ReviewRequest.objects.filter(reviewer=request.user).select_related('student', 'student__profile')
    feedback_items = VideoFeedback.objects.filter(review_request__reviewer=request.user).select_related('review_request', 'review_request__student', 'review_request__student__profile')

    category_counts = {}
    for feedback_item in feedback_items:
        category = str(feedback_item.feedback_category or '').strip().lower()
        if not category:
            continue
        category_counts[category] = category_counts.get(category, 0) + 1

    top_students = []
    students = {}
    for review_request in review_requests.order_by('-created_at'):
        student_id = review_request.student_id
        bucket = students.setdefault(student_id, {
            'student': review_request.student,
            'request_count': 0,
            'follow_up_request_count': 0,
            'category_counts': {},
            'last_request_at': review_request.created_at,
        })
        bucket['request_count'] += 1
        if review_request.parent_request_id:
            bucket['follow_up_request_count'] += 1
        if review_request.created_at > bucket['last_request_at']:
            bucket['last_request_at'] = review_request.created_at

    for feedback_item in feedback_items:
        student_id = feedback_item.review_request.student_id if feedback_item.review_request_id else None
        if not student_id or student_id not in students:
            continue
        category = str(feedback_item.feedback_category or '').strip().lower()
        if not category:
            continue
        bucket = students[student_id]['category_counts']
        bucket[category] = bucket.get(category, 0) + 1

    for student_data in students.values():
        top_students.append({
            'student': UserSummarySerializer(student_data['student']).data,
            'request_count': student_data['request_count'],
            'follow_up_request_count': student_data['follow_up_request_count'],
            'category_counts': student_data['category_counts'],
            'last_request_at': student_data['last_request_at'],
        })

    top_students.sort(key=lambda item: (-item['request_count'], item['student']['display_name'].lower()))

    return Response({
        'total_review_requests': review_requests.count(),
        'pending_review_requests': review_requests.filter(status__in=[ReviewRequest.STATUS_REQUESTED, ReviewRequest.STATUS_OPENED]).count(),
        'responded_review_requests': review_requests.filter(status__in=[ReviewRequest.STATUS_RESPONDED, ReviewRequest.STATUS_VIEWED, ReviewRequest.STATUS_RESUBMITTED, ReviewRequest.STATUS_CLOSED]).count(),
        'follow_up_review_requests': review_requests.exclude(parent_request__isnull=True).count(),
        'category_counts': category_counts,
        'top_students': top_students,
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def feedback_templates(request):
    if request.method == 'GET':
        templates = FeedbackTemplate.objects.filter(reviewer=request.user).order_by('title', '-updated_at')
        return Response(FeedbackTemplateSerializer(templates, many=True, context={'request': request}).data)

    serializer = FeedbackTemplateSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    template = serializer.save(reviewer=request.user)
    return Response(FeedbackTemplateSerializer(template, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def feedback_template_detail(request, template_id):
    template = get_object_or_404(FeedbackTemplate, pk=template_id, reviewer=request.user)
    if request.method == 'DELETE':
        template.delete()
        return Response({'ok': True})

    serializer = FeedbackTemplateSerializer(template, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


reviewer_inbox = feedback_inbox
reviewer_connections = member_connections
reviewer_roster = member_connections
reviewer_insights = feedback_insights
reviewer_templates = feedback_templates
reviewer_template_detail = feedback_template_detail


@method_decorator(csrf_exempt, name='dispatch')
class ReviewRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewRequestSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = visible_review_requests_qs(self.request.user).select_related(
            'session', 'session__user', 'session__user__profile',
            'reviewer', 'reviewer__profile',
            'student', 'student__profile',
            'review_link',
            'parent_request',
        ).prefetch_related(
            'feedback_items', 'feedback_items__user', 'feedback_items__user__profile',
        )
        return filter_review_requests_for_role(
            qs,
            user=self.request.user,
            role=self.request.query_params.get('role', ''),
            session_id=self.request.query_params.get('session_id', ''),
            status_filter=self.request.query_params.get('status', ''),
        )

    def perform_create(self, serializer):
        create_review_request(serializer=serializer, actor=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        review_request = self.get_object()
        if not review_request_visible_to_user(review_request, request.user):
            raise PermissionDenied('You do not have access to this review request.')

        allowed_fields = {'goal', 'exercise_or_song', 'notes', 'deadline', 'requested_turnaround_hours', 'student_level'}
        if 'status' in request.data:
            transition_review_request_status(
                review_request=review_request,
                actor=request.user,
                next_status=request.data.get('status', ''),
            )

        partial_payload = {key: value for key, value in request.data.items() if key in allowed_fields}
        if partial_payload:
            serializer = self.get_serializer(review_request, data=partial_payload, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        review_request.refresh_from_db()
        return Response(self.get_serializer(review_request).data)

    @action(detail=True, methods=['post'], url_path='mark-viewed')
    def mark_viewed(self, request, pk=None):
        review_request = self.get_object()
        mark_review_request_viewed(review_request=review_request, actor=request.user)
        return Response(self.get_serializer(review_request).data)
