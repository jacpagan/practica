PRODUCT_EVENT_SOURCE = 'ProductEvent'
PRODUCT_EVENT_EXTRA_WHITELIST = {
    'action',
    'session_id',
    'review_request_id',
    'invite_id',
    'invite_intent',
    'review_token_present',
    'claim_source',
    'reason',
    'processing_status',
    'via_claim_link',
    'category',
    'has_note',
    'response_mode',
    'prior_status',
    'practice_series',
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


def log_product_event(logger, request, event_name='', extra=None, path_override=''):
    request_id = request.META.get('HTTP_X_REQUEST_ID', '')
    raw_extra = extra if isinstance(extra, dict) else {}
    normalized_extra = normalized_product_event_extra(raw_extra)
    client_trace_id = str(raw_extra.get('client_trace_id', '')).strip()[:128]
    safe_path = sanitized_event_path(path_override or request.path)
    safe_name = str(event_name or '').strip()[:80] or 'unknown'
    logger.info(
        'ProductEvent event_name=%s path=%s is_authenticated=%s request_id=%s client_trace_id=%s extra=%s',
        safe_name,
        safe_path or 'unknown',
        bool(getattr(request.user, 'is_authenticated', False)),
        request_id,
        client_trace_id or 'n/a',
        normalized_extra,
    )
