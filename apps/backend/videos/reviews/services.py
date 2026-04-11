import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from videos.models import ReviewLink, ReviewRequest, ReviewRequestEvent, ReviewerInvite, ReviewerRosterMembership, Session, SessionLastSeen, SignupInviteCode


REVIEW_REQUEST_ALLOWED_TRANSITIONS = {
    ReviewRequest.STATUS_REQUESTED: {
        ReviewRequest.STATUS_OPENED,
        ReviewRequest.STATUS_RESPONDED,
        ReviewRequest.STATUS_NEEDS_RESUBMISSION,
        ReviewRequest.STATUS_DECLINED_UNRELATED,
        ReviewRequest.STATUS_FLAGGED,
        ReviewRequest.STATUS_REVOKED,
        ReviewRequest.STATUS_CLOSED,
    },
    ReviewRequest.STATUS_OPENED: {
        ReviewRequest.STATUS_RESPONDED,
        ReviewRequest.STATUS_NEEDS_RESUBMISSION,
        ReviewRequest.STATUS_DECLINED_UNRELATED,
        ReviewRequest.STATUS_FLAGGED,
        ReviewRequest.STATUS_REVOKED,
        ReviewRequest.STATUS_CLOSED,
    },
    ReviewRequest.STATUS_RESPONDED: {
        ReviewRequest.STATUS_VIEWED,
        ReviewRequest.STATUS_RESUBMITTED,
        ReviewRequest.STATUS_CLOSED,
    },
    ReviewRequest.STATUS_VIEWED: {
        ReviewRequest.STATUS_RESUBMITTED,
        ReviewRequest.STATUS_CLOSED,
    },
    ReviewRequest.STATUS_NEEDS_RESUBMISSION: {
        ReviewRequest.STATUS_RESUBMITTED,
        ReviewRequest.STATUS_REVOKED,
        ReviewRequest.STATUS_CLOSED,
    },
    ReviewRequest.STATUS_DECLINED_UNRELATED: {
        ReviewRequest.STATUS_RESUBMITTED,
        ReviewRequest.STATUS_REVOKED,
        ReviewRequest.STATUS_CLOSED,
    },
    ReviewRequest.STATUS_FLAGGED: {
        ReviewRequest.STATUS_CLOSED,
        ReviewRequest.STATUS_REVOKED,
    },
    ReviewRequest.STATUS_RESUBMITTED: {
        ReviewRequest.STATUS_CLOSED,
    },
}


def _ensure_active_review_link(*, actor, session):
    existing_link = session.review_links.filter(is_active=True, expires_at__gt=timezone.now()).order_by('-created_at').first()
    if existing_link:
        return existing_link
    return ReviewLink.objects.create(
        session=session,
        token=secrets.token_urlsafe(16),
        created_by=actor,
        expires_at=timezone.now() + timedelta(days=7),
        is_active=True,
        allow_video_feedback=True,
    )


@transaction.atomic
def create_reviewer_invite(*, actor, session, label='', intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW, review_request=None):
    if session.user_id != actor.id and not actor.is_staff:
        raise PermissionDenied('You can only invite reviewers for your own sessions.')
    if session.processing_status != Session.STATUS_READY:
        raise ValidationError({'session_id': 'This session must be playback ready before inviting a reviewer.'})

    review_link = review_request.review_link if review_request and review_request.review_link_id else _ensure_active_review_link(actor=actor, session=session)
    invite_code = SignupInviteCode.objects.create(
        label=str(label or '').strip() or f'Access {session.title}',
        created_by=actor,
        max_uses=1,
    )
    return ReviewerInvite.objects.create(
        created_by=actor,
        student=session.user,
        invite_code=invite_code,
        review_link=review_link,
        session=session,
        review_request=review_request,
        intent=intent if intent in {ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW, ReviewerInvite.INTENT_ROSTER_JOIN} else ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
        label=str(label or '').strip(),
        expires_at=review_link.expires_at,
    )


@transaction.atomic
def revoke_reviewer_invite(*, reviewer_invite, actor):
    if actor.id not in {reviewer_invite.created_by_id, reviewer_invite.student_id} and not actor.is_staff:
        raise PermissionDenied('You do not have access to this reviewer invite.')
    reviewer_invite.mark_expired_if_needed(save=True)
    if reviewer_invite.status == ReviewerInvite.STATUS_CLAIMED:
        raise ValidationError({'error': 'Claimed reviewer invites cannot be revoked.'})
    if reviewer_invite.status == ReviewerInvite.STATUS_REVOKED:
        return reviewer_invite
    reviewer_invite.status = ReviewerInvite.STATUS_REVOKED
    reviewer_invite.save(update_fields=['status', 'updated_at'])
    if reviewer_invite.invite_code_id and reviewer_invite.invite_code.is_active:
        reviewer_invite.invite_code.is_active = False
        reviewer_invite.invite_code.save(update_fields=['is_active', 'updated_at'])
    return reviewer_invite


def claim_reviewer_invite(*, reviewer_invite, actor, deactivate_signup_code=False):
    reviewer_invite.mark_expired_if_needed(save=True)
    if reviewer_invite.status == ReviewerInvite.STATUS_REVOKED:
        raise ValidationError({'claim_code': 'This reviewer invite has been turned off.'})
    if reviewer_invite.status == ReviewerInvite.STATUS_EXPIRED:
        raise ValidationError({'claim_code': 'This reviewer invite has expired.'})
    if reviewer_invite.status == ReviewerInvite.STATUS_CLAIMED:
        if reviewer_invite.claimed_by_id != actor.id and not actor.is_staff:
            raise ValidationError({'claim_code': 'This reviewer invite has already been claimed.'})
        ensure_member_connection(reviewer=actor, student=reviewer_invite.student, created_by=reviewer_invite.created_by)
        return reviewer_invite

    with transaction.atomic():
        reviewer_invite.status = ReviewerInvite.STATUS_CLAIMED
        reviewer_invite.claimed_by = actor
        reviewer_invite.claimed_at = timezone.now()
        reviewer_invite.save(update_fields=['status', 'claimed_by', 'claimed_at', 'updated_at'])
        if deactivate_signup_code and reviewer_invite.invite_code_id and reviewer_invite.invite_code.is_active:
            reviewer_invite.invite_code.is_active = False
            reviewer_invite.invite_code.save(update_fields=['is_active', 'updated_at'])
        ensure_member_connection(reviewer=actor, student=reviewer_invite.student, created_by=reviewer_invite.created_by)
    return reviewer_invite


def claim_reviewer_invite_by_code(*, code, actor, deactivate_signup_code=False):
    normalized_code = str(code or '').strip().upper()
    if not normalized_code:
        raise ValidationError({'claim_code': 'Claim code is required.'})
    reviewer_invite = ReviewerInvite.objects.select_related('invite_code', 'student', 'created_by').filter(invite_code__code__iexact=normalized_code).order_by('-created_at').first()
    if not reviewer_invite:
        raise ValidationError({'claim_code': 'This reviewer invite is not available.'})
    return claim_reviewer_invite(reviewer_invite=reviewer_invite, actor=actor, deactivate_signup_code=deactivate_signup_code)


def _record_review_request_event(*, review_request, actor, event_type, from_status='', to_status='', reason_code='', note=''):
    return ReviewRequestEvent.objects.create(
        review_request=review_request,
        actor=actor,
        event_type=event_type,
        from_status=str(from_status or '').strip(),
        to_status=str(to_status or '').strip(),
        reason_code=str(reason_code or '').strip(),
        note=str(note or '').strip(),
    )


def _set_review_request_status(*, review_request, next_status, reason_code='', note=''):
    review_request.status = next_status
    review_request.status_reason = str(reason_code or '').strip()
    review_request.status_note = str(note or '').strip()


def _validate_transition(review_request, next_status):
    current_status = str(review_request.status or '').strip().lower()
    allowed = REVIEW_REQUEST_ALLOWED_TRANSITIONS.get(current_status, set())
    if next_status not in allowed:
        raise ValidationError({'status': f'Cannot move review request from {current_status or "unknown"} to {next_status}.'})


@transaction.atomic
def ensure_member_connection(*, reviewer, student, created_by=None):
    membership, created = ReviewerRosterMembership.objects.get_or_create(
        reviewer=reviewer,
        student=student,
        defaults={
            'created_by': created_by,
            'is_active': True,
        },
    )
    if not created and not membership.is_active:
        membership.is_active = True
        if created_by and membership.created_by_id is None:
            membership.created_by = created_by
        membership.save(update_fields=['is_active', 'created_by', 'updated_at'])
    return membership


@transaction.atomic
def create_review_request(*, serializer, actor):
    review_request = serializer.save(
        student=actor,
        created_by=actor,
    )
    if review_request.parent_request_id:
        parent_request = review_request.parent_request
        from_status = parent_request.status
        parent_request.status = ReviewRequest.STATUS_RESUBMITTED
        parent_request.status_reason = ''
        parent_request.status_note = ''
        parent_request.resubmitted_at = timezone.now()
        parent_request.save(update_fields=['status', 'status_reason', 'status_note', 'resubmitted_at', 'updated_at'])
        _record_review_request_event(
            review_request=parent_request,
            actor=actor,
            event_type=ReviewRequestEvent.EVENT_STATUS_CHANGED,
            from_status=from_status,
            to_status=parent_request.status,
        )

    link = ReviewLink.objects.create(
        session=review_request.session,
        token=secrets.token_urlsafe(16),
        created_by=actor,
        expires_at=timezone.now() + timedelta(days=7),
        is_active=True,
        allow_video_feedback=True,
    )
    review_request.review_link = link
    review_request.save(update_fields=['review_link', 'updated_at'])
    _record_review_request_event(
        review_request=review_request,
        actor=actor,
        event_type=ReviewRequestEvent.EVENT_CREATED,
        to_status=review_request.status,
    )
    return review_request


@transaction.atomic
def mark_review_request_opened(*, review_request, actor):
    if actor.id != review_request.reviewer_id and not actor.is_staff:
        raise PermissionDenied('Only the assigned reviewer can open this review request.')
    if review_request.status != ReviewRequest.STATUS_REQUESTED:
        return review_request
    _validate_transition(review_request, ReviewRequest.STATUS_OPENED)
    from_status = review_request.status
    review_request.status = ReviewRequest.STATUS_OPENED
    review_request.opened_at = timezone.now()
    review_request.save(update_fields=['status', 'opened_at', 'updated_at'])
    _record_review_request_event(
        review_request=review_request,
        actor=actor,
        event_type=ReviewRequestEvent.EVENT_OPENED,
        from_status=from_status,
        to_status=review_request.status,
    )
    return review_request


@transaction.atomic
def mark_review_request_responded(*, review_request, actor):
    if actor.id != review_request.reviewer_id and not actor.is_staff:
        raise PermissionDenied('Only the assigned reviewer can respond to this review request.')
    if review_request.status == ReviewRequest.STATUS_RESPONDED:
        return review_request
    _validate_transition(review_request, ReviewRequest.STATUS_RESPONDED)
    from_status = review_request.status
    review_request.status = ReviewRequest.STATUS_RESPONDED
    review_request.status_reason = ''
    review_request.status_note = ''
    review_request.responded_at = timezone.now()
    review_request.save(update_fields=['status', 'status_reason', 'status_note', 'responded_at', 'updated_at'])
    _record_review_request_event(
        review_request=review_request,
        actor=actor,
        event_type=ReviewRequestEvent.EVENT_RESPONDED,
        from_status=from_status,
        to_status=review_request.status,
    )
    return review_request


@transaction.atomic
def transition_review_request_status(*, review_request, actor, next_status):
    normalized_status = str(next_status or '').strip().lower()
    reason_code = ''
    note = ''
    if isinstance(next_status, dict):
        normalized_status = str(next_status.get('status', '') or '').strip().lower()
        reason_code = str(next_status.get('status_reason', '') or '').strip().lower()
        note = str(next_status.get('status_note', '') or '').strip()

    if not normalized_status:
        raise ValidationError({'status': 'Status is required.'})

    from_status = review_request.status
    _validate_transition(review_request, normalized_status)

    if actor.id == review_request.student_id and normalized_status == ReviewRequest.STATUS_RESUBMITTED:
        _set_review_request_status(review_request=review_request, next_status=ReviewRequest.STATUS_RESUBMITTED)
        review_request.resubmitted_at = timezone.now()
        review_request.save(update_fields=['status', 'status_reason', 'status_note', 'resubmitted_at', 'updated_at'])
        _record_review_request_event(
            review_request=review_request,
            actor=actor,
            event_type=ReviewRequestEvent.EVENT_STATUS_CHANGED,
            from_status=from_status,
            to_status=review_request.status,
        )
        return review_request

    if actor.id in {review_request.student_id, review_request.reviewer_id} and normalized_status == ReviewRequest.STATUS_CLOSED:
        _set_review_request_status(review_request=review_request, next_status=ReviewRequest.STATUS_CLOSED, reason_code=reason_code, note=note)
        review_request.closed_at = timezone.now()
        review_request.save(update_fields=['status', 'status_reason', 'status_note', 'closed_at', 'updated_at'])
        _record_review_request_event(
            review_request=review_request,
            actor=actor,
            event_type=ReviewRequestEvent.EVENT_STATUS_CHANGED,
            from_status=from_status,
            to_status=review_request.status,
            reason_code=reason_code,
            note=note,
        )
        return review_request

    if actor.id == review_request.student_id and normalized_status == ReviewRequest.STATUS_REVOKED:
        _set_review_request_status(review_request=review_request, next_status=ReviewRequest.STATUS_REVOKED, reason_code=reason_code, note=note)
        review_request.closed_at = timezone.now()
        if review_request.review_link_id:
            ReviewLink.objects.filter(pk=review_request.review_link_id).update(is_active=False)
        review_request.save(update_fields=['status', 'status_reason', 'status_note', 'closed_at', 'updated_at'])
        _record_review_request_event(
            review_request=review_request,
            actor=actor,
            event_type=ReviewRequestEvent.EVENT_STATUS_CHANGED,
            from_status=from_status,
            to_status=review_request.status,
            reason_code=reason_code,
            note=note,
        )
        return review_request

    if actor.id == review_request.reviewer_id and normalized_status in {
        ReviewRequest.STATUS_NEEDS_RESUBMISSION,
        ReviewRequest.STATUS_DECLINED_UNRELATED,
        ReviewRequest.STATUS_FLAGGED,
    }:
        default_reason = {
            ReviewRequest.STATUS_NEEDS_RESUBMISSION: ReviewRequest.REASON_NEEDS_NEW_TAKE,
            ReviewRequest.STATUS_DECLINED_UNRELATED: ReviewRequest.REASON_UNRELATED_VIDEO,
            ReviewRequest.STATUS_FLAGGED: ReviewRequest.REASON_UNSAFE_CONTENT,
        }[normalized_status]
        final_reason = reason_code or default_reason
        _set_review_request_status(review_request=review_request, next_status=normalized_status, reason_code=final_reason, note=note)
        update_fields = ['status', 'status_reason', 'status_note', 'updated_at']
        if normalized_status == ReviewRequest.STATUS_FLAGGED:
            review_request.flagged_at = timezone.now()
            update_fields.append('flagged_at')
        review_request.save(update_fields=update_fields)
        _record_review_request_event(
            review_request=review_request,
            actor=actor,
            event_type=ReviewRequestEvent.EVENT_STATUS_CHANGED,
            from_status=from_status,
            to_status=review_request.status,
            reason_code=final_reason,
            note=note,
        )
        return review_request

    raise PermissionDenied('This status transition is not allowed.')


@transaction.atomic
def mark_review_request_viewed(*, review_request, actor):
    if actor.id not in {review_request.student_id, review_request.reviewer_id} and not actor.is_staff:
        raise PermissionDenied('You do not have access to this review request.')

    if actor.id == review_request.student_id:
        if review_request.status != ReviewRequest.STATUS_RESPONDED:
            raise ValidationError({'status': 'Only responded requests can be marked viewed.'})
        from_status = review_request.status
        review_request.status = ReviewRequest.STATUS_VIEWED
        review_request.viewed_at = timezone.now()
        review_request.save(update_fields=['status', 'viewed_at', 'updated_at'])
        _record_review_request_event(
            review_request=review_request,
            actor=actor,
            event_type=ReviewRequestEvent.EVENT_VIEWED,
            from_status=from_status,
            to_status=review_request.status,
        )

    SessionLastSeen.objects.update_or_create(
        user=actor,
        session=review_request.session,
        defaults={},
    )
    return review_request
