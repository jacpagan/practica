from celery import shared_task

from videos.models import Session
from videos.views import _start_processing_pipeline


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def process_uploaded_session(self, session_id):
    session = Session.objects.filter(pk=session_id).first()
    if not session:
        return {'ok': False, 'error': 'session_not_found'}
    _start_processing_pipeline(session)
    return {'ok': True, 'status': session.status}
