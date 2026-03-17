import logging
from dataclasses import dataclass
from typing import Iterable

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@dataclass
class NotificationMessage:
    subject: str
    body: str
    recipients: list[str]


class BaseNotificationProvider:
    def send(self, message: NotificationMessage) -> bool:
        raise NotImplementedError


class DjangoEmailNotificationProvider(BaseNotificationProvider):
    def send(self, message: NotificationMessage) -> bool:
        if not message.recipients:
            return False
        send_mail(
            subject=message.subject,
            message=message.body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@practica.local'),
            recipient_list=message.recipients,
            fail_silently=False,
        )
        return True


def _provider() -> BaseNotificationProvider:
    # Swappable abstraction for SES/Postmark/Resend integrations.
    provider = (getattr(settings, 'NOTIFICATIONS_PROVIDER', 'django_email') or '').strip().lower()
    if provider in {'django_email', 'ses', 'postmark', 'resend'}:
        return DjangoEmailNotificationProvider()
    return DjangoEmailNotificationProvider()


def send_notification(subject: str, body: str, recipients: Iterable[str]) -> bool:
    clean_recipients = [str(email).strip() for email in recipients if str(email).strip()]
    if not clean_recipients:
        return False
    try:
        return _provider().send(NotificationMessage(subject=subject, body=body, recipients=clean_recipients))
    except Exception:
        logger.exception('Notification send failed subject=%s recipients=%s', subject, clean_recipients)
        return False
