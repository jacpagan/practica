from django.conf import settings

from videos.models import Session
from videos.telemetry import record_product_event
from videos.services.media_pipeline import (
    configured_video_processing_mode,
    enqueue_local_session_transcode,
    enqueue_session_processing,
    sync_mediaconvert_session,
)


def normalized_client_upload_id(raw_value):
    value = str(raw_value or '').strip()
    return value[:64]


def _record_processing_event(*, event_name, session, path='/api/sessions/:id/', extra=None):
    payload = {
        'session_id': session.id,
        'processing_status': session.processing_status,
    }
    if extra:
        payload.update(extra)
    record_product_event(
        event_name=event_name,
        path=path,
        user=session.user,
        is_authenticated=bool(session.user_id),
        extra=payload,
    )


def start_processing_pipeline(session):
    session.processing_status = Session.STATUS_PROCESSING
    session.processing_job_id = ''
    session.processing_error = ''
    session.save(update_fields=['processing_status', 'processing_job_id', 'processing_error', 'updated_at'])
    raw_mode = str(getattr(settings, 'VIDEO_PROCESSING_MODE', 'auto') or 'auto').strip().lower()
    selected_mode = configured_video_processing_mode()
    _record_processing_event(
        event_name='session_processing_started',
        session=session,
        extra={
            'processing_mode': selected_mode,
            'action': 'start_processing_pipeline',
        },
    )

    if raw_mode == 'mediaconvert':
        if selected_mode != 'mediaconvert':
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = (
                'VIDEO_PROCESSING_MODE is set to mediaconvert, but the MediaConvert configuration is incomplete. '
                'Set AWS_STORAGE_BUCKET_NAME, AWS_MEDIA_CONVERT_ROLE_ARN, and AWS_MEDIA_CONVERT_ENDPOINT_URL.'
            )
            _record_processing_event(
                event_name='session_processing_failed',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': 'mediaconvert_not_configured',
                    'action': 'start_processing_pipeline',
                },
            )
        else:
            queued, error, job_id = enqueue_session_processing(session)
            if queued:
                session.processing_job_id = job_id
                session.save(update_fields=['processing_job_id', 'updated_at'])
                _record_processing_event(
                    event_name='session_processing_enqueued',
                    session=session,
                    extra={
                        'processing_mode': selected_mode,
                        'action': 'enqueue_session_processing',
                        'reason': 'mediaconvert',
                    },
                )
                return session
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = (error or 'Failed to enqueue media processing')[:2000]
            _record_processing_event(
                event_name='session_processing_failed',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': error or 'Failed to enqueue media processing',
                    'action': 'enqueue_session_processing',
                },
            )

    elif raw_mode == 'local_ffmpeg':
        if selected_mode != 'local_ffmpeg':
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = 'VIDEO_PROCESSING_MODE is set to local_ffmpeg, but ffmpeg is not available.'
            _record_processing_event(
                event_name='session_processing_failed',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': 'local_ffmpeg_unavailable',
                    'action': 'start_processing_pipeline',
                },
            )
        else:
            queued_local, local_error = enqueue_local_session_transcode(session)
            if queued_local:
                _record_processing_event(
                    event_name='session_processing_enqueued',
                    session=session,
                    extra={
                        'processing_mode': selected_mode,
                        'reason': 'local_ffmpeg',
                        'action': 'enqueue_local_session_transcode',
                    },
                )
                return session
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = (
                'VIDEO_PROCESSING_MODE is set to local_ffmpeg, but local transcoding is unavailable. '
                f'Local transcoding is unavailable: {local_error or "ffmpeg missing"}. '
                'Install ffmpeg or switch VIDEO_PROCESSING_MODE to mediaconvert.'
            )
            _record_processing_event(
                event_name='session_processing_failed',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': local_error or 'ffmpeg missing',
                    'action': 'enqueue_local_session_transcode',
                },
            )

    else:
        queued, error, job_id = enqueue_session_processing(session)
        if queued:
            session.processing_job_id = job_id
            session.save(update_fields=['processing_job_id', 'updated_at'])
            _record_processing_event(
                event_name='session_processing_enqueued',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': 'mediaconvert',
                    'action': 'enqueue_session_processing',
                },
            )
            return session

        if 'not configured' in error.lower():
            queued_local, local_error = enqueue_local_session_transcode(session)
            if queued_local:
                _record_processing_event(
                    event_name='session_processing_enqueued',
                    session=session,
                    extra={
                        'processing_mode': selected_mode,
                        'reason': 'local_ffmpeg_fallback',
                        'action': 'enqueue_local_session_transcode',
                    },
                )
                return session
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = (
                'Upload finished, but browser playback needs transcoding and playback conversion is unavailable. '
                f'Local transcoding is unavailable: {local_error or "ffmpeg missing"}. '
                'Set VIDEO_PROCESSING_MODE to mediaconvert or local_ffmpeg.'
            )
            _record_processing_event(
                event_name='session_processing_failed',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': local_error or 'ffmpeg missing',
                    'action': 'enqueue_local_session_transcode',
                },
            )
        else:
            session.processing_status = Session.STATUS_FAILED
            session.processing_error = (error or 'Failed to enqueue media processing')[:2000]
            _record_processing_event(
                event_name='session_processing_failed',
                session=session,
                extra={
                    'processing_mode': selected_mode,
                    'reason': error or 'Failed to enqueue media processing',
                    'action': 'enqueue_session_processing',
                },
            )

    session.processing_job_id = ''
    session.save(update_fields=['processing_status', 'processing_job_id', 'processing_error', 'updated_at'])
    return session


def maybe_refresh_session_processing(session):
    if not session:
        return session
    if session.processing_status != Session.STATUS_PROCESSING:
        return session
    if not getattr(session, 'processing_job_id', ''):
        return session
    return sync_mediaconvert_session(session)
