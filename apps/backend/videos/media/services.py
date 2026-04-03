from videos.models import Session
from videos.services.media_pipeline import (
    enqueue_local_session_transcode,
    enqueue_session_processing,
    sync_mediaconvert_session,
)


def normalized_client_upload_id(raw_value):
    value = str(raw_value or '').strip()
    return value[:64]


def start_processing_pipeline(session):
    session.processing_status = Session.STATUS_PROCESSING
    session.processing_job_id = ''
    session.processing_error = ''
    session.save(update_fields=['processing_status', 'processing_job_id', 'processing_error', 'updated_at'])

    queued, error, job_id = enqueue_session_processing(session)
    if queued:
        session.processing_job_id = job_id
        session.save(update_fields=['processing_job_id', 'updated_at'])
        return session

    if 'not configured' in error.lower():
        queued_local, local_error = enqueue_local_session_transcode(session)
        if queued_local:
            return session
        session.processing_status = Session.STATUS_FAILED
        session.processing_error = (
            'Upload finished, but browser playback needs transcoding and playback conversion is unavailable. '
            f'Local transcoding is unavailable: {local_error or "ffmpeg missing"}. '
            'Enable AWS MediaConvert or local ffmpeg so uploaded videos can be converted for browser playback.'
        )
    else:
        session.processing_status = Session.STATUS_FAILED
        session.processing_error = (error or 'Failed to enqueue media processing')[:2000]

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
