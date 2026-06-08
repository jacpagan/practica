import json

from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from videos.media.uploads import direct_uploads_enabled, s3_client
from videos.models import MultipartSessionUpload


class Command(BaseCommand):
    help = 'Abort expired direct-to-S3 multipart uploads and mark their records expired.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100, help='Maximum expired uploads to inspect.')
        parser.add_argument('--dry-run', action='store_true', help='Report work without aborting S3 uploads or saving records.')

    def handle(self, *args, **options):
        limit = max(1, min(1000, int(options.get('limit') or 100)))
        dry_run = bool(options.get('dry_run'))

        if not direct_uploads_enabled():
            self.stdout.write(json.dumps({'status': 'skipped', 'reason': 'direct_uploads_not_configured'}))
            return

        queryset = (
            MultipartSessionUpload.objects
            .filter(status=MultipartSessionUpload.STATUS_INITIATED, expires_at__lte=timezone.now())
            .order_by('expires_at', 'id')[:limit]
        )

        inspected = 0
        expired = 0
        abort_failed = 0
        client = s3_client()
        for upload in queryset:
            inspected += 1
            if not dry_run:
                try:
                    client.abort_multipart_upload(
                        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                        Key=upload.s3_key,
                        UploadId=upload.s3_upload_id,
                    )
                except ClientError as exc:
                    code = str(exc.response.get('Error', {}).get('Code', ''))
                    if code != 'NoSuchUpload':
                        abort_failed += 1
                        continue
                except BotoCoreError:
                    abort_failed += 1
                    continue

                upload.status = MultipartSessionUpload.STATUS_EXPIRED
                upload.save(update_fields=['status', 'updated_at'])
            expired += 1

        self.stdout.write(json.dumps({
            'status': 'ok',
            'dry_run': dry_run,
            'inspected': inspected,
            'expired': expired,
            'abort_failed': abort_failed,
        }))
