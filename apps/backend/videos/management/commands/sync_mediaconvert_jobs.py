import json

from django.core.management.base import BaseCommand

from videos.models import Session
from videos.services.media_pipeline import media_pipeline_enabled, sync_mediaconvert_session


class Command(BaseCommand):
    help = 'Sync processing sessions from AWS MediaConvert job status.'

    def add_arguments(self, parser):
        parser.add_argument('--session-id', type=int, help='Sync one session id only.')

    def handle(self, *args, **options):
        if not media_pipeline_enabled():
            self.stdout.write(json.dumps({'status': 'skipped', 'reason': 'mediaconvert_not_configured'}))
            return

        queryset = Session.objects.filter(processing_status=Session.STATUS_PROCESSING).exclude(processing_job_id='').order_by('id')
        session_id = options.get('session_id')
        if session_id:
            queryset = queryset.filter(pk=session_id)

        processed = 0
        ready = 0
        failed = 0
        for session in queryset.iterator():
            before = session.processing_status
            sync_mediaconvert_session(session)
            session.refresh_from_db(fields=['processing_status'])
            processed += 1
            if session.processing_status == Session.STATUS_READY and before != Session.STATUS_READY:
                ready += 1
            if session.processing_status == Session.STATUS_FAILED and before != Session.STATUS_FAILED:
                failed += 1

        self.stdout.write(json.dumps({
            'status': 'ok',
            'processed': processed,
            'ready': ready,
            'failed': failed,
        }))
