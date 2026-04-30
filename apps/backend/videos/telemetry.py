import logging

from .models import ProductEventLog

PRODUCT_EVENT_SOURCE = 'ProductEvent'

logger = logging.getLogger(__name__)


PRODUCT_EVENT_EXTRA_WHITELIST = {
    'action',
    'code',
    'file_size_bytes',
    'phase',
    'processing_mode',
    'session_id',
    'review_request_id',
    'invite_id',
    'invite_intent',
    'review_token_present',
    'claim_source',
    'reason',
    'notification_channel',
    'notification_kind',
    'recipient_role',
    'recipient_has_email',
    'processing_status',
    'via_claim_link',
    'category',
    'has_note',
    'response_mode',
    'prior_status',
    'practice_series',
    'filter',
    'sort',
    'status',
    'upload_mode',
}


def sanitized_event_path(path):
    raw = str(path or '').strip()
    if not raw:
        return '/'
    base = raw.split('?', 1)[0]
    if base.startswith('/r/'):
        return '/r/:token'
    if base.startswith('/api/review/') and base.endswith('/feedback/'):
        return '/api/review/:token/feedback/'
    if base.startswith('/api/review/'):
        return '/api/review/:token/'
    return base


def _normalized_log_extra_value(value):
    if value is None:
        return ''
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else value
    return str(value).strip()[:160]


def normalized_product_event_extra(extra):
    normalized = {}
    if not isinstance(extra, dict):
        return normalized
    for key in PRODUCT_EVENT_EXTRA_WHITELIST:
        if key not in extra:
            continue
        value = _normalized_log_extra_value(extra.get(key))
        if value == '':
            continue
        normalized[key] = value
    return normalized


def record_product_event(*, event_name='', path='', user=None, is_authenticated=None, client_trace_id='', request_id='n/a', extra=None, logger_obj=None):
    raw_extra = extra if isinstance(extra, dict) else {}
    normalized_extra = normalized_product_event_extra(raw_extra)
    safe_name = str(event_name or '').strip()[:80] or 'unknown'
    safe_path = sanitized_event_path(path)
    normalized_is_authenticated = bool(is_authenticated if is_authenticated is not None else getattr(user, 'is_authenticated', False))
    ProductEventLog.objects.create(
        event_name=safe_name,
        path=safe_path,
        user=user if normalized_is_authenticated else None,
        is_authenticated=normalized_is_authenticated,
        client_trace_id=str(client_trace_id or '').strip()[:128],
        extra_json=normalized_extra,
    )
    (logger_obj or logger).info(
        'ProductEvent event_name=%s path=%s is_authenticated=%s request_id=%s client_trace_id=%s extra=%s',
        safe_name,
        safe_path or 'unknown',
        normalized_is_authenticated,
        str(request_id or '').strip()[:128] or 'n/a',
        str(client_trace_id or '').strip()[:128] or 'n/a',
        normalized_extra,
    )
    return normalized_extra


def log_product_event(logger, request, event_name='', extra=None, path_override=''):
    request_id = request.META.get('HTTP_X_REQUEST_ID', '')
    raw_extra = extra if isinstance(extra, dict) else {}
    record_product_event(
        event_name=event_name,
        path=path_override or request.path,
        user=request.user if getattr(request.user, 'is_authenticated', False) else None,
        is_authenticated=bool(getattr(request.user, 'is_authenticated', False)),
        client_trace_id=str(raw_extra.get('client_trace_id', '')).strip()[:128],
        request_id=request_id,
        extra=raw_extra,
        logger_obj=logger,
    )
