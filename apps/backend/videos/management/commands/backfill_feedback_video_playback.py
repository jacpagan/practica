import json

from django.core.management.base import BaseCommand, CommandError

from videos.models import VideoFeedback
from videos.services.feedback_video_processing import (
    ensure_feedback_video_playback_key,
    feedback_video_is_browser_safe,
)
from videos.services.media_pipeline import local_transcode_enabled


class Command(BaseCommand):
    help = 'Generate browser-safe MP4 playback files for existing feedback videos.'

    def add_arguments(self, parser):
        parser.add_argument('--feedback-id', type=int, help='Backfill one feedback item by id.')
        parser.add_argument('--session-id', type=int, help='Backfill feedback items for one session.')
        parser.add_argument('--dry-run', action='store_true', help='Report what would be backfilled without writing files.')

    def handle(self, *args, **options):
        feedback_id = options.get('feedback_id')
        session_id = options.get('session_id')
        dry_run = bool(options.get('dry_run'))

        queryset = VideoFeedback.objects.select_related('session', 'user').exclude(feedback_video='').exclude(feedback_video__isnull=True)
        if feedback_id:
            queryset = queryset.filter(pk=feedback_id)
        if session_id:
            queryset = queryset.filter(session_id=session_id)

        feedback_items = list(queryset.order_by('id'))

        if not dry_run and feedback_items and not local_transcode_enabled():
            raise CommandError('ffmpeg is not installed in this environment.')

        summary = {
            'checked': 0,
            'safe_original': 0,
            'backfilled': 0,
            'dry_run_candidates': 0,
            'failed': 0,
        }

        if not feedback_items:
            self.stdout.write(json.dumps({'summary': summary}))
            return

        for feedback in feedback_items:
            summary['checked'] += 1
            source_key = str(feedback.feedback_video.name or '').strip()
            if not source_key:
                continue

            if feedback_video_is_browser_safe(feedback.feedback_video):
                summary['safe_original'] += 1
                self.stdout.write(json.dumps({
                    'feedback_id': feedback.id,
                    'session_id': feedback.session_id,
                    'status': 'safe_original',
                    'source_key': source_key,
                }))
                continue

            if dry_run:
                summary['dry_run_candidates'] += 1
                self.stdout.write(json.dumps({
                    'feedback_id': feedback.id,
                    'session_id': feedback.session_id,
                    'status': 'would_backfill',
                    'source_key': source_key,
                }))
                continue

            try:
                playback_key = ensure_feedback_video_playback_key(feedback)
            except Exception as exc:
                summary['failed'] += 1
                self.stderr.write(json.dumps({
                    'feedback_id': feedback.id,
                    'session_id': feedback.session_id,
                    'status': 'failed',
                    'source_key': source_key,
                    'error': str(exc),
                }))
                continue

            status = 'backfilled' if playback_key and playback_key != source_key else 'unchanged'
            if status == 'backfilled':
                summary['backfilled'] += 1
            else:
                summary['failed'] += 1

            stream = self.stdout if status == 'backfilled' else self.stderr
            payload = {
                'feedback_id': feedback.id,
                'session_id': feedback.session_id,
                'status': status,
                'source_key': source_key,
                'playback_key': playback_key,
            }
            stream.write(json.dumps(payload))

        self.stdout.write(json.dumps({'summary': summary}))
