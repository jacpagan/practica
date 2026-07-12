import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from videos.models import FeedbackTemplate, ProofChallengeResponse, ReviewLink, ReviewRequest, ReviewerInvite, ReviewerRosterMembership, Session, SkillShareLink, VideoFeedback
from videos.reviews.presentation import public_review_request_preview, review_request_forbidden_response
from videos.reviews.queries import filter_review_requests_for_role, review_request_visible_to_user, reviewer_can_respond, visible_review_requests_qs
from videos.reviews.services import claim_reviewer_invite_by_code, create_review_request, create_reviewer_invite, mark_review_request_viewed, revoke_reviewer_invite, transition_review_request_status
from videos.reviews.services import mark_review_request_opened, mark_review_request_responded
from videos.serializers import FeedbackTemplateSerializer, MemberConnectionSerializer, ProofChallengeResponseSerializer, PublicSessionSerializer, ReviewerInviteSerializer, ReviewLinkSerializer, ReviewRequestSerializer, ReviewVideoFeedbackSerializer, SkillShareLinkSerializer, UserSummarySerializer
from videos.services.feedback_video_processing import prepare_feedback_video_upload
from videos.telemetry import log_product_event
from videos.video_uploads import is_allowed_video_upload


logger = logging.getLogger(__name__)


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


def _resolve_skill_share_link(token):
    normalized_token = str(token or '').strip()
    if not normalized_token:
        return None, 'invalid'

    link = SkillShareLink.objects.select_related(
        'owner',
        'owner__profile',
    ).filter(token=normalized_token).first()
    if not link:
        return None, 'invalid'
    if not link.is_active:
        return None, 'revoked'
    if link.expires_at <= timezone.now():
        return None, 'expired'
    return link, None


def _skill_share_link_error_response(reason):
    if reason == 'expired':
        return Response(
            {'error': 'This skill share link has expired.', 'code': 'skill_share_expired'},
            status=status.HTTP_410_GONE,
        )
    if reason == 'revoked':
        return Response(
            {'error': 'This skill share link has been turned off.', 'code': 'skill_share_revoked'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return Response(
        {'error': 'This skill share link does not exist.', 'code': 'skill_share_invalid'},
        status=status.HTTP_404_NOT_FOUND,
    )


def _normalized_client_upload_id(raw_value):
    value = str(raw_value or '').strip()
    return value[:64]


def _validation_error_reason(exc):
    detail = getattr(exc, 'detail', {})
    if isinstance(detail, dict):
        messages = []
        for value in detail.values():
            if isinstance(value, list):
                messages.extend(str(item) for item in value)
            else:
                messages.append(str(value))
        return ', '.join(messages)[:160]
    return str(detail)[:160]


def _create_review_feedback_response(request, *, session, review_request=None):
    if review_request and not reviewer_can_respond(review_request, request.user):
        return review_request_forbidden_response(
            'Only the assigned reviewer can respond to this review request.'
        )

    serializer = ReviewVideoFeedbackSerializer(data=request.data, context={'request': request, 'session': session})
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
            session=session,
            review_request=review_request,
            user=request.user,
            client_upload_id=client_upload_id,
        ).first()
        if existing:
            return Response(
                ReviewVideoFeedbackSerializer(existing, context={'request': request, 'session': session}).data,
                status=status.HTTP_200_OK,
            )

    had_prior_response = VideoFeedback.objects.filter(
        session=session,
        review_request=review_request,
        user=request.user,
    ).exists()

    item = VideoFeedback.objects.create(
        session=session,
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
        mark_review_request_responded(review_request=review_request, actor=request.user)
        if not had_prior_response:
            log_product_event(
                logger,
                request,
                event_name='reviewer_first_response_submitted',
                extra={
                    'action': 'api_review_feedback_create',
                    'session_id': session.id,
                    'review_request_id': review_request.id,
                    'via_claim_link': False,
                    'category': item.feedback_category,
                    'has_note': bool(item.text),
                    'response_mode': 'video',
                },
            )
    return Response(
        ReviewVideoFeedbackSerializer(item, context={'request': request, 'session': session}).data,
        status=status.HTTP_201_CREATED,
    )


def _update_or_delete_review_feedback_response(request, *, session, review_request=None):
    raw_feedback_id = request.data.get('feedback_id') or request.query_params.get('feedback_id')
    try:
        feedback_id = int(raw_feedback_id)
    except (TypeError, ValueError):
        return Response({'error': 'feedback_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    feedback = get_object_or_404(VideoFeedback, pk=feedback_id, session=session)
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

    return Response(ReviewVideoFeedbackSerializer(feedback, context={'request': request, 'session': session}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def review_link_info(request, token):
    link, error_reason = _resolve_review_link(token)
    if error_reason:
        return _review_link_error_response(error_reason)
    review_request = getattr(link, 'review_request', None)
    if request.user.is_authenticated and review_request and not review_request_visible_to_user(review_request, request.user):
        return review_request_forbidden_response(
            'This review request is only available to the assigned reviewer and creator.'
        )
    ReviewLink.objects.filter(pk=link.pk).update(last_accessed_at=timezone.now())
    link.refresh_from_db(fields=['last_accessed_at'])
    if request.user.is_authenticated and review_request and review_request.status == ReviewRequest.STATUS_REQUESTED and request.user.id == review_request.reviewer_id:
        mark_review_request_opened(review_request=review_request, actor=request.user)
        review_request.refresh_from_db()
    elif request.user.is_authenticated and review_request and request.user.id == review_request.student_id:
        if review_request.status == ReviewRequest.STATUS_RESPONDED:
            mark_review_request_viewed(review_request=review_request, actor=request.user)
            review_request.refresh_from_db()
    claimed_invite = None
    claim_error = ''
    claim_code = str(request.query_params.get('claim', '') or '').strip()
    if request.user.is_authenticated and claim_code:
        try:
            claimed_invite = claim_reviewer_invite_by_code(code=claim_code, actor=request.user, deactivate_signup_code=True)
            log_product_event(
                logger,
                request,
                event_name='reviewer_invite_claimed',
                extra={
                    'action': 'review_link_open',
                    'invite_id': claimed_invite.id,
                    'session_id': claimed_invite.session_id,
                    'review_token_present': True,
                    'claim_source': 'review_link',
                },
            )
        except ValidationError as exc:
            claim_error = _validation_error_reason(exc)
            log_product_event(
                logger,
                request,
                event_name='reviewer_invite_claim_failed',
                extra={
                    'action': 'review_link_open',
                    'reason': claim_error,
                    'review_token_present': True,
                    'claim_source': 'review_link',
                },
            )
    if request.user.is_authenticated:
        request_payload = ReviewRequestSerializer(review_request, context={'request': request}).data if review_request else None
    else:
        request_payload = public_review_request_preview(review_request)
    payload = {
        'session': PublicSessionSerializer(link.session, context={'request': request}).data,
        'link': ReviewLinkSerializer(link, context={'request': request}).data,
        'auth_required': True,
        'review_request': request_payload,
        'feedback_request': request_payload,
    }
    if claimed_invite:
        payload['reviewer_invite'] = ReviewerInviteSerializer(claimed_invite, context={'request': request}).data
    if claim_error:
        payload['claim_error'] = claim_error
    return Response(payload)


@api_view(['GET'])
@permission_classes([AllowAny])
def skill_share_link_info(request, token):
    link, error_reason = _resolve_skill_share_link(token)
    if error_reason:
        return _skill_share_link_error_response(error_reason)

    SkillShareLink.objects.filter(pk=link.pk).update(last_accessed_at=timezone.now())
    link.refresh_from_db(fields=['last_accessed_at'])
    sessions = Session.objects.filter(
        user=link.owner,
        practice_series=link.practice_series,
        processing_status=Session.STATUS_READY,
    ).prefetch_related('assets').order_by('-recorded_at', '-id')
    proof_days = sessions.datetimes('recorded_at', 'day').count()
    owner_name = link.owner.username
    if hasattr(link.owner, 'profile') and link.owner.profile.display_name:
        owner_name = link.owner.profile.display_name
    payload = {
        'skill': {
            'name': link.practice_series,
            'proof_count': sessions.count(),
            'proof_days': proof_days,
            'owner_display_name': owner_name,
        },
        'link': SkillShareLinkSerializer(link, context={'request': request}).data,
        'sessions': PublicSessionSerializer(sessions, many=True, context={'request': request}).data,
    }
    return Response(payload)


@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def review_link_feedback(request, token):
    link, error_reason = _resolve_review_link(token)
    if error_reason:
        return _review_link_error_response(error_reason)
    review_request = getattr(link, 'review_request', None)
    if review_request and not review_request_visible_to_user(review_request, request.user):
        return review_request_forbidden_response(
            'This review request is only available to the assigned reviewer and creator.'
        )

    if request.method == 'GET':
        feedback = link.session.video_feedback.select_related('user', 'user__profile')
        if review_request:
            feedback = feedback.filter(review_request=review_request)
        feedback = feedback.order_by('timestamp_seconds', 'created_at')
        return Response(ReviewVideoFeedbackSerializer(feedback, many=True, context={'request': request, 'session': link.session}).data)

    if request.method in {'PATCH', 'DELETE'}:
        return _update_or_delete_review_feedback_response(request, session=link.session, review_request=review_request)

    if not link.allow_video_feedback:
        return Response(
            {
                'error': 'Video feedback is disabled for this link',
                'code': 'review_link_feedback_disabled',
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return _create_review_feedback_response(
        request,
        session=link.session,
        review_request=review_request,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_link_challenge_response(request, token):
    link, error_reason = _resolve_review_link(token)
    if error_reason:
        return _review_link_error_response(error_reason)

    raw_session_id = request.data.get('response_session_id') or request.data.get('session_id')
    try:
        response_session_id = int(raw_session_id)
    except (TypeError, ValueError):
        return Response({'error': 'response_session_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    response_session = Session.objects.filter(pk=response_session_id, user=request.user).first()
    if not response_session:
        return Response({'error': 'Response proof not found'}, status=status.HTTP_404_NOT_FOUND)

    existing = ProofChallengeResponse.objects.filter(response_session=response_session).first()
    if existing:
        if existing.challenge_link_id != link.id:
            return Response(
                {'error': 'This proof is already a response to another challenge.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(ProofChallengeResponseSerializer(existing, context={'request': request}).data, status=status.HTTP_200_OK)

    challenge_response = ProofChallengeResponse.objects.create(
        challenge_link=link,
        source_session=link.session,
        responder=request.user,
        response_session=response_session,
    )
    log_product_event(
        logger,
        request,
        event_name='proof_challenge_response_created',
        extra={
            'action': 'proof_challenge_response_created',
            'source_session_id': link.session_id,
            'response_session_id': response_session.id,
        },
    )
    return Response(
        ProofChallengeResponseSerializer(challenge_response, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def review_request_feedback(request, request_id):
    review_request = get_object_or_404(
        ReviewRequest.objects.select_related(
            'session', 'session__user', 'session__user__profile',
            'reviewer', 'reviewer__profile',
            'student', 'student__profile',
            'review_link',
        ),
        pk=request_id,
    )
    if not review_request_visible_to_user(review_request, request.user):
        return review_request_forbidden_response(
            'This review request is only available to the assigned reviewer and creator.'
        )
    if request.method == 'GET':
        feedback = review_request.session.video_feedback.select_related('user', 'user__profile')
        feedback = feedback.filter(review_request=review_request).order_by('timestamp_seconds', 'created_at')
        return Response(ReviewVideoFeedbackSerializer(feedback, many=True, context={'request': request, 'session': review_request.session}).data)
    if request.method in {'PATCH', 'DELETE'}:
        return _update_or_delete_review_feedback_response(request, session=review_request.session, review_request=review_request)
    return _create_review_feedback_response(
        request,
        session=review_request.session,
        review_request=review_request,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def feedback_inbox(request):
    qs = ReviewRequest.objects.filter(reviewer=request.user).select_related(
        'student', 'student__profile', 'reviewer', 'reviewer__profile', 'session', 'review_link'
    ).prefetch_related(
        'feedback_items', 'feedback_items__user', 'feedback_items__user__profile',
        'events', 'events__actor', 'events__actor__profile',
    ).exclude(status=ReviewRequest.STATUS_FLAGGED).order_by('-created_at')
    status_filter = str(request.query_params.get('status', '')).strip().lower()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return Response(ReviewRequestSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reviewer_invites(request):
    if request.method == 'GET':
        invites = ReviewerInvite.objects.select_related(
            'student', 'student__profile',
            'claimed_by', 'claimed_by__profile',
            'session', 'session__user', 'session__user__profile',
            'review_link', 'invite_code',
        ).filter(student=request.user).order_by('-created_at')
        session_id = str(request.query_params.get('session_id', '')).strip()
        if session_id:
            invites = invites.filter(session_id=session_id)
        return Response(ReviewerInviteSerializer(invites, many=True, context={'request': request}).data)

    raw_session_id = request.data.get('session_id')
    try:
        session_id = int(raw_session_id)
    except (TypeError, ValueError):
        return Response({'session_id': ['Session is required.']}, status=status.HTTP_400_BAD_REQUEST)
    session = get_object_or_404(Session, pk=session_id)
    label = str(request.data.get('label', '') or '').strip()
    intent = str(request.data.get('intent', '') or ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW).strip().lower()
    invite = create_reviewer_invite(actor=request.user, session=session, label=label, intent=intent)
    log_product_event(
        logger,
        request,
        event_name='reviewer_invite_created',
        extra={
            'action': 'api_reviewer_invites_create',
            'session_id': session.id,
            'invite_id': invite.id,
            'invite_intent': invite.intent,
        },
    )
    return Response(ReviewerInviteSerializer(invite, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def reviewer_invite_detail(request, invite_id):
    invite = get_object_or_404(ReviewerInvite.objects.select_related('invite_code'), pk=invite_id)
    invite = revoke_reviewer_invite(reviewer_invite=invite, actor=request.user)
    return Response(ReviewerInviteSerializer(invite, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reviewer_invite_claim(request):
    claim_code = str(request.data.get('claim_code', '') or '').strip()
    try:
        invite = claim_reviewer_invite_by_code(code=claim_code, actor=request.user, deactivate_signup_code=True)
    except ValidationError as exc:
        log_product_event(
            logger,
            request,
            event_name='reviewer_invite_claim_failed',
            extra={
                'action': 'api_reviewer_invite_claim',
                'reason': _validation_error_reason(exc),
                'review_token_present': False,
                'claim_source': 'claim_endpoint',
            },
        )
        raise
    log_product_event(
        logger,
        request,
        event_name='reviewer_invite_claimed',
        extra={
            'action': 'api_reviewer_invite_claim',
            'invite_id': invite.id,
            'session_id': invite.session_id,
            'review_token_present': False,
            'claim_source': 'claim_endpoint',
        },
    )
    return Response(ReviewerInviteSerializer(invite, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def member_connections(request):
    role = str(request.query_params.get('role', '')).strip().lower()
    if role in {'student', 'owner', 'member', 'creator'}:
        memberships = ReviewerRosterMembership.objects.filter(student=request.user, is_active=True).select_related(
            'reviewer', 'reviewer__profile', 'student', 'student__profile'
        ).order_by('reviewer__username')
    else:
        memberships = ReviewerRosterMembership.objects.filter(reviewer=request.user, is_active=True).select_related(
            'student', 'student__profile', 'reviewer', 'reviewer__profile'
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

    top_members = []
    members = {}
    for review_request in review_requests.order_by('-created_at'):
        student_id = review_request.student_id
        bucket = members.setdefault(student_id, {
            'member': review_request.student,
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
        if not student_id or student_id not in members:
            continue
        category = str(feedback_item.feedback_category or '').strip().lower()
        if not category:
            continue
        bucket = members[student_id]['category_counts']
        bucket[category] = bucket.get(category, 0) + 1

    for member_data in members.values():
        top_members.append({
            'member': UserSummarySerializer(member_data['member']).data,
            'request_count': member_data['request_count'],
            'follow_up_request_count': member_data['follow_up_request_count'],
            'category_counts': member_data['category_counts'],
            'last_request_at': member_data['last_request_at'],
        })

    top_members.sort(key=lambda item: (-item['request_count'], item['member']['display_name'].lower()))

    return Response({
        'total_review_requests': review_requests.count(),
        'pending_review_requests': review_requests.filter(status__in=[ReviewRequest.STATUS_REQUESTED, ReviewRequest.STATUS_OPENED]).count(),
        'responded_review_requests': review_requests.filter(status__in=[ReviewRequest.STATUS_RESPONDED, ReviewRequest.STATUS_VIEWED, ReviewRequest.STATUS_NEEDS_RESUBMISSION, ReviewRequest.STATUS_DECLINED_UNRELATED, ReviewRequest.STATUS_RESUBMITTED, ReviewRequest.STATUS_CLOSED]).count(),
        'follow_up_review_requests': review_requests.exclude(parent_request__isnull=True).count(),
        'category_counts': category_counts,
        'top_members': top_members,
        'top_creators': top_members,
        'top_students': top_members,
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
            'events', 'events__actor', 'events__actor__profile',
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
                next_status={
                    'status': request.data.get('status', ''),
                    'status_reason': request.data.get('status_reason', ''),
                    'status_note': request.data.get('status_note', ''),
                },
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
