import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from videos.models import ReviewLink, ReviewRequest, ReviewerRosterMembership, SessionLastSeen


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
        parent_request.status = ReviewRequest.STATUS_RESUBMITTED
        parent_request.resubmitted_at = timezone.now()
        parent_request.save(update_fields=['status', 'resubmitted_at', 'updated_at'])

    ensure_member_connection(
        reviewer=review_request.reviewer,
        student=review_request.student,
        created_by=actor,
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
    return review_request


@transaction.atomic
def transition_review_request_status(*, review_request, actor, next_status):
    normalized_status = str(next_status or '').strip().lower()

    if actor.id == review_request.student_id and normalized_status == ReviewRequest.STATUS_RESUBMITTED:
        review_request.status = ReviewRequest.STATUS_RESUBMITTED
        review_request.resubmitted_at = timezone.now()
        review_request.save(update_fields=['status', 'resubmitted_at', 'updated_at'])
        return review_request

    if actor.id in {review_request.student_id, review_request.reviewer_id} and normalized_status == ReviewRequest.STATUS_CLOSED:
        review_request.status = ReviewRequest.STATUS_CLOSED
        review_request.closed_at = timezone.now()
        review_request.save(update_fields=['status', 'closed_at', 'updated_at'])
        return review_request

    if actor.id == review_request.student_id and normalized_status == ReviewRequest.STATUS_REVOKED:
        review_request.status = ReviewRequest.STATUS_REVOKED
        review_request.closed_at = timezone.now()
        if review_request.review_link_id:
            ReviewLink.objects.filter(pk=review_request.review_link_id).update(is_active=False)
        review_request.save(update_fields=['status', 'closed_at', 'updated_at'])
        return review_request

    raise PermissionDenied('This status transition is not allowed.')


@transaction.atomic
def mark_review_request_viewed(*, review_request, actor):
    if actor.id not in {review_request.student_id, review_request.reviewer_id} and not actor.is_staff:
        raise PermissionDenied('You do not have access to this review request.')

    if actor.id == review_request.student_id:
        review_request.status = ReviewRequest.STATUS_VIEWED
        review_request.viewed_at = timezone.now()
        review_request.save(update_fields=['status', 'viewed_at', 'updated_at'])

    SessionLastSeen.objects.update_or_create(
        user=actor,
        session=review_request.session,
        defaults={},
    )
    return review_request
