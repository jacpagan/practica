from django.db.models import Q

from videos.models import ReviewRequest


def review_request_visible_to_user(review_request, user):
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    return user.id in {review_request.student_id, review_request.reviewer_id}


def reviewer_can_respond(review_request, user):
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    return user.id == review_request.reviewer_id


def visible_review_requests_qs(user):
    if not user.is_authenticated:
        return ReviewRequest.objects.none()
    if user.is_staff:
        return ReviewRequest.objects.all()
    return ReviewRequest.objects.filter(Q(student=user) | Q(reviewer=user) | Q(created_by=user))


def filter_review_requests_for_role(qs, *, user, role='', session_id='', status_filter=''):
    normalized_role = str(role or '').strip().lower()
    normalized_session_id = str(session_id or '').strip()
    normalized_status_filter = str(status_filter or '').strip().lower()

    if normalized_session_id.isdigit():
        qs = qs.filter(session_id=int(normalized_session_id))

    if normalized_role == 'reviewer':
        qs = qs.filter(reviewer=user)
    elif normalized_role in {'student', 'owner'}:
        qs = qs.filter(student=user)

    if normalized_status_filter:
        qs = qs.filter(status=normalized_status_filter)

    return qs
