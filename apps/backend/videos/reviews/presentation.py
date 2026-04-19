from rest_framework import status
from rest_framework.response import Response


def _display_name(user):
    if not user:
        return ''
    profile = getattr(user, 'profile', None)
    if profile and getattr(profile, 'display_name', ''):
        return profile.display_name
    return getattr(user, 'username', '') or ''


def _with_resolution_timestamp(payload, occurred_at=None, occurred_label=''):
    if occurred_at:
        payload['occurred_at'] = occurred_at
    if occurred_label:
        payload['occurred_label'] = occurred_label
    return payload


def resolve_session_resolution(session, user=None):
    status_value = str(getattr(session, 'processing_status', '') or '').strip().lower()
    can_edit = bool(
        user
        and getattr(user, 'is_authenticated', False)
        and (getattr(user, 'is_staff', False) or session.user_id == user.id)
    )

    if status_value == 'ready':
        return {
            'code': 'ready_for_review',
            'phase': 'complete',
            'summary': 'Ready for review',
            'detail': 'This take is ready to watch, share, or request feedback.',
            'awaiting_actor': 'owner' if can_edit else 'none',
        }

    if status_value == 'failed':
        return {
            'code': 'playback_failed',
            'phase': 'blocked',
            'summary': 'Playback processing failed',
            'detail': str(getattr(session, 'processing_error', '') or 'This take is not ready for browser playback yet.').strip(),
            'awaiting_actor': 'owner' if can_edit else 'none',
        }

    return _with_resolution_timestamp(
        {
            'code': 'processing',
            'phase': 'waiting',
            'summary': 'Preparing playback',
            'detail': 'Your take is saved. You can request feedback once playback is ready.',
            'awaiting_actor': 'system',
        },
        getattr(session, 'created_at', None),
        'Saved',
    )


def resolve_review_request_resolution(review_request, user=None):
    status_value = str(getattr(review_request, 'status', '') or '').strip().lower()
    role = review_request.member_role_for(user)
    reviewer_name = _display_name(getattr(review_request, 'reviewer', None)) or 'your reviewer'

    if role == 'reviewer':
        if status_value in {'requested', 'opened'}:
            return _with_resolution_timestamp(
                {
                    'code': 'respond_now',
                    'phase': 'action_required',
                    'summary': 'Your response is next',
                    'detail': 'Watch the take, then send one response video to keep this private thread moving.',
                    'awaiting_actor': 'reviewer',
                },
                review_request.opened_at or review_request.created_at,
                'Opened' if review_request.opened_at else 'Requested',
            )
        if status_value == 'responded':
            return _with_resolution_timestamp(
                {
                    'code': 'waiting_on_owner',
                    'phase': 'waiting',
                    'summary': 'Waiting on creator',
                    'detail': 'Your response is in the thread. The creator has not reviewed it yet.',
                    'awaiting_actor': 'owner',
                },
                review_request.responded_at,
                'Responded',
            )
        if status_value == 'viewed':
            return _with_resolution_timestamp(
                {
                    'code': 'owner_viewed',
                    'phase': 'complete',
                    'summary': 'Creator viewed feedback',
                    'detail': 'The creator has seen your feedback and can decide whether to continue the loop.',
                    'awaiting_actor': 'owner',
                },
                review_request.viewed_at,
                'Viewed',
            )
        if status_value in {'needs_resubmission', 'declined_unrelated'}:
            return _with_resolution_timestamp(
                {
                    'code': 'waiting_on_owner',
                    'phase': 'waiting',
                    'summary': 'Waiting for a new take',
                    'detail': 'You asked the creator to send another take before continuing.',
                    'awaiting_actor': 'owner',
                },
                review_request.updated_at,
                'Updated',
            )
        if status_value == 'flagged':
            return {
                'code': 'flagged',
                'phase': 'blocked',
                'summary': 'Request flagged',
                'detail': 'This request is outside the normal review loop for now.',
                'awaiting_actor': 'none',
            }

    if role in {'owner', 'creator'}:
        if status_value in {'requested', 'opened', 'resubmitted'}:
            return _with_resolution_timestamp(
                {
                    'code': 'waiting_on_reviewer',
                    'phase': 'waiting',
                    'summary': 'Waiting on reviewer',
                    'detail': f'Waiting for {reviewer_name} to respond.',
                    'awaiting_actor': 'reviewer',
                },
                review_request.opened_at or review_request.created_at,
                'Opened' if review_request.opened_at else 'Requested',
            )
        if status_value == 'responded':
            return _with_resolution_timestamp(
                {
                    'code': 'feedback_ready',
                    'phase': 'action_required',
                    'summary': 'Feedback is ready',
                    'detail': f'Open the response from {reviewer_name}, then decide whether to continue or close the thread.',
                    'awaiting_actor': 'owner',
                },
                review_request.responded_at,
                'Responded',
            )
        if status_value == 'viewed':
            return _with_resolution_timestamp(
                {
                    'code': 'record_next_take',
                    'phase': 'action_required',
                    'summary': 'Ready for the next take',
                    'detail': 'You have seen the feedback. Record the next take when you are ready.',
                    'awaiting_actor': 'owner',
                },
                review_request.viewed_at,
                'Viewed',
            )
        if status_value == 'needs_resubmission':
            return {
                'code': 'record_new_take',
                'phase': 'action_required',
                'summary': 'New take requested',
                'detail': 'Record a new take to continue this thread.',
                'awaiting_actor': 'owner',
            }
        if status_value == 'declined_unrelated':
            return {
                'code': 'record_matching_take',
                'phase': 'action_required',
                'summary': 'Matching take needed',
                'detail': 'Record the matching take to continue this thread.',
                'awaiting_actor': 'owner',
            }
        if status_value in {'closed', 'revoked'}:
            return {
                'code': status_value,
                'phase': 'complete',
                'summary': 'Thread closed',
                'detail': 'This review thread is no longer active.',
                'awaiting_actor': 'none',
            }

    return {
        'code': status_value or 'unknown',
        'phase': 'waiting',
        'summary': 'Private review thread',
        'detail': 'Open the thread to review the current state.',
        'awaiting_actor': 'none',
    }


def resolve_reviewer_invite_resolution(reviewer_invite, user=None):
    status_value = str(getattr(reviewer_invite, 'status', '') or '').strip().lower()
    claim_name = _display_name(getattr(reviewer_invite, 'claimed_by', None)) or 'your reviewer'
    session_title = str(getattr(getattr(reviewer_invite, 'session', None), 'title', '') or 'this take').strip()

    viewer_is_creator = bool(
        user and getattr(user, 'is_authenticated', False)
        and (getattr(user, 'is_staff', False) or user.id == reviewer_invite.student_id or user.id == reviewer_invite.created_by_id)
    )
    viewer_is_claimant = bool(
        user and getattr(user, 'is_authenticated', False)
        and user.id == reviewer_invite.claimed_by_id
    )

    if status_value == 'pending':
        return _with_resolution_timestamp(
            {
                'code': 'invite_pending',
                'phase': 'waiting',
                'summary': 'Waiting for reviewer to join',
                'detail': 'This invite is ready to claim. Share the private link with the person you want feedback from.',
                'awaiting_actor': 'reviewer',
            },
            getattr(reviewer_invite, 'created_at', None),
            'Created',
        )

    if status_value == 'claimed':
        if viewer_is_claimant:
            return _with_resolution_timestamp(
                {
                    'code': 'review_access_ready',
                    'phase': 'action_required',
                    'summary': 'You’re in',
                    'detail': f'You can review {session_title} privately now, and this learner can ask you again later without a new invite.',
                    'awaiting_actor': 'reviewer',
                },
                reviewer_invite.claimed_at,
                'Claimed',
            )
        if viewer_is_creator:
            return _with_resolution_timestamp(
                {
                    'code': 'reviewer_joined',
                    'phase': 'complete',
                    'summary': 'Reviewer joined',
                    'detail': f'{claim_name} claimed this invite and can review privately now.',
                    'awaiting_actor': 'owner',
                },
                reviewer_invite.claimed_at,
                'Claimed',
            )
        return _with_resolution_timestamp(
            {
                'code': 'reviewer_joined',
                'phase': 'complete',
                'summary': 'Invite claimed',
                'detail': 'This private reviewer invite has already been claimed.',
                'awaiting_actor': 'none',
            },
            reviewer_invite.claimed_at,
            'Claimed',
        )

    if status_value == 'expired':
        return {
            'code': 'invite_expired',
            'phase': 'blocked',
            'summary': 'Invite expired',
            'detail': 'This invite is no longer active. Create a new one if you still want private feedback from this person.',
            'awaiting_actor': 'owner',
        }

    if status_value == 'revoked':
        return {
            'code': 'invite_revoked',
            'phase': 'complete',
            'summary': 'Invite turned off',
            'detail': 'This invite was turned off and can no longer be claimed.',
            'awaiting_actor': 'owner',
        }

    return {
        'code': status_value or 'unknown',
        'phase': 'waiting',
        'summary': 'Reviewer invite',
        'detail': 'Check this invite to see whether the reviewer has joined yet.',
        'awaiting_actor': 'none',
    }


def review_request_forbidden_response(message='You do not have access to this feedback request.'):
    return Response(
        {
            'error': message,
            'code': 'review_request_forbidden',
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def public_review_request_preview(review_request):
    if not review_request:
        return None
    from videos.serializers import UserSummarySerializer

    return {
        'id': review_request.id,
        'status': review_request.status,
        'instrument': review_request.instrument,
        'goal': review_request.goal,
        'creator': UserSummarySerializer(review_request.student).data,
        'member': UserSummarySerializer(review_request.student).data,
        'owner': UserSummarySerializer(review_request.student).data,
        'reviewer': UserSummarySerializer(review_request.reviewer).data,
        'creator_id': review_request.student_id,
        'member_id': review_request.student_id,
        'owner_id': review_request.student_id,
        'reviewer_id': review_request.reviewer_id,
    }
