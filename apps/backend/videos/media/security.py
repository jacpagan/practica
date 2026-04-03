import secrets

from django.conf import settings


def processing_callback_authorized(request):
    shared_token = (getattr(settings, 'MEDIA_PROCESSING_CALLBACK_TOKEN', '') or '').strip()
    if shared_token:
        provided = str(request.headers.get('X-Processing-Token', '')).strip()
        return provided and secrets.compare_digest(provided, shared_token)
    return bool(request.user.is_authenticated and request.user.is_staff)

