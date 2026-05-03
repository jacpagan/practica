import logging
from urllib.parse import urljoin

from django.conf import settings
from django.core.mail import send_mail

from videos.telemetry import record_product_event


logger = logging.getLogger(__name__)


def _app_url(path):
    base = str(getattr(settings, 'APP_BASE_URL', '') or '').strip().rstrip('/')
    normalized_path = '/' + str(path or '').strip().lstrip('/')
    if not base:
        return normalized_path
    return urljoin(f'{base}/', normalized_path.lstrip('/'))


def _display_name(user):
    if not user:
        return ''
    profile = getattr(user, 'profile', None)
    display_name = str(getattr(profile, 'display_name', '') or '').strip()
    if display_name:
        return display_name
    return str(getattr(user, 'username', '') or '').strip()


def _recipient_email(user):
    return str(getattr(user, 'email', '') or '').strip()


def _email_notifications_enabled():
    return bool(getattr(settings, 'EMAIL_NOTIFICATIONS_ENABLED', False))


def _notification_delivery(review_request, recipient, notification_kind, status, reason=''):
    recipient_name = _display_name(recipient) or ('reviewer' if notification_kind == 'review_request_created' else 'owner')
    recipient_email = _recipient_email(recipient)
    if status == 'sent':
        message = f'Email sent to {recipient_name}. They will also see it in Practica when they sign in.'
    elif status == 'missing_email':
        message = f'No email on file for {recipient_name}; they will still see it in Practica when they sign in.'
    elif status == 'disabled':
        message = f'Email notifications are turned off; {recipient_name} will still see it in Practica when they sign in.'
    else:
        message = f'Email could not be sent to {recipient_name}; they will still see it in Practica when they sign in.'
    return {
        'status': status,
        'message': message,
        'notification_kind': notification_kind,
        'recipient_name': recipient_name,
        'recipient_email': recipient_email,
        'reason': reason,
        'session_id': review_request.session_id,
        'review_request_id': review_request.id,
    }


def _record_notification_event(*, event_name, review_request, actor, recipient, notification_kind, channel='email', status='sent', reason='', path='/api/review-requests/'):
    record_product_event(
        event_name=event_name,
        path=path,
        user=actor,
        is_authenticated=bool(getattr(actor, 'is_authenticated', False)),
        extra={
            'action': event_name,
            'session_id': review_request.session_id,
            'review_request_id': review_request.id,
            'notification_channel': channel,
            'notification_kind': notification_kind,
            'recipient_role': 'reviewer' if recipient and recipient.id == review_request.reviewer_id else 'owner',
            'recipient_has_email': bool(_recipient_email(recipient)),
            'status': status,
            'reason': reason,
        },
    )


def _send_notification_email(*, review_request, actor, recipient, subject, body, notification_kind, path='/api/review-requests/', event_name='review_request_notification_sent'):
    recipient_email = _recipient_email(recipient)
    if not recipient_email:
        logger.info(
            'Notification email skipped: missing recipient email review_request_id=%s notification_kind=%s',
            review_request.id,
            notification_kind,
        )
        _record_notification_event(
            event_name='review_request_notification_skipped',
            review_request=review_request,
            actor=actor,
            recipient=recipient,
            notification_kind=notification_kind,
            status='missing_email',
            reason='recipient_has_no_email',
            path=path,
        )
        return _notification_delivery(review_request, recipient, notification_kind, 'missing_email', 'recipient_has_no_email')

    if not _email_notifications_enabled():
        logger.info(
            'Notification email disabled: review_request_id=%s notification_kind=%s recipient=%s',
            review_request.id,
            notification_kind,
            recipient_email,
        )
        _record_notification_event(
            event_name='review_request_notification_skipped',
            review_request=review_request,
            actor=actor,
            recipient=recipient,
            notification_kind=notification_kind,
            status='disabled',
            reason='email_notifications_disabled',
            path=path,
        )
        return _notification_delivery(review_request, recipient, notification_kind, 'disabled', 'email_notifications_disabled')

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=[recipient_email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.exception(
            'Notification email failed: review_request_id=%s notification_kind=%s recipient=%s',
            review_request.id,
            notification_kind,
            recipient_email,
        )
        _record_notification_event(
            event_name='review_request_notification_failed',
            review_request=review_request,
            actor=actor,
            recipient=recipient,
            notification_kind=notification_kind,
            status='failed',
            reason=str(exc)[:160],
            path=path,
        )
        return _notification_delivery(review_request, recipient, notification_kind, 'failed', str(exc)[:160])

    logger.info(
        'Notification email sent: review_request_id=%s notification_kind=%s recipient=%s',
        review_request.id,
        notification_kind,
        recipient_email,
    )
    _record_notification_event(
        event_name=event_name,
        review_request=review_request,
        actor=actor,
        recipient=recipient,
        notification_kind=notification_kind,
        status='sent',
        path=path,
    )
    return _notification_delivery(review_request, recipient, notification_kind, 'sent')


def send_review_request_created_notification(*, review_request, actor):
    recipient = review_request.reviewer
    reviewer_name = _display_name(recipient)
    owner_name = _display_name(review_request.student)
    session_title = str(review_request.session.title or '').strip()
    subject = f'Practica: new review request for {session_title}'
    body = '\n'.join(
        [
            f'Hi {reviewer_name or "there"},',
            '',
            f'{owner_name or "A member"} sent you a new review request for "{session_title}".',
            f'Instrument: {review_request.instrument or "unspecified"}',
            f'Goal: {review_request.goal or "unspecified"}',
            '',
            f'Open the thread in Practica: {_app_url(f"/requests/{review_request.id}")}',
            f'Private link: {_app_url(f"/r/{review_request.review_link.token}")}',
            '',
            'If you do not want email notifications, open Practica directly instead.',
        ]
    )
    return _send_notification_email(
        review_request=review_request,
        actor=actor,
        recipient=recipient,
        subject=subject,
        body=body,
        notification_kind='review_request_created',
        path='/api/review-requests/',
    )


def send_review_request_responded_notification(*, review_request, actor):
    recipient = review_request.student
    owner_name = _display_name(recipient)
    reviewer_name = _display_name(review_request.reviewer)
    session_title = str(review_request.session.title or '').strip()
    subject = f'Practica: feedback received for {session_title}'
    body = '\n'.join(
        [
            f'Hi {owner_name or "there"},',
            '',
            f'{reviewer_name or "Your reviewer"} responded to "{session_title}".',
            f'Instrument: {review_request.instrument or "unspecified"}',
            f'Goal: {review_request.goal or "unspecified"}',
            '',
            f'Open the thread in Practica: {_app_url(f"/requests/{review_request.id}")}',
            f'Private link: {_app_url(f"/r/{review_request.review_link.token}")}',
            '',
            'You can mark it viewed in Practica once you have seen it.',
        ]
    )
    return _send_notification_email(
        review_request=review_request,
        actor=actor,
        recipient=recipient,
        subject=subject,
        body=body,
        notification_kind='review_request_responded',
        path='/api/review/:token/feedback/',
    )
