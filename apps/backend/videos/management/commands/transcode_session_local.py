import json
import os
import subprocess
import tempfile
from pathlib import Path

from django.core.files.base import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from videos.models import Session, SessionAsset
from videos.services.media_pipeline import apply_processing_update, local_transcode_enabled


class Command(BaseCommand):
    help = 'Transcode a session video locally with ffmpeg into a browser-friendly MP4 proxy.'

    def add_arguments(self, parser):
        parser.add_argument('session_id', type=int)

    def handle(self, *args, **options):
        if not local_transcode_enabled():
            raise CommandError('ffmpeg is not installed in this environment.')

        session = Session.objects.filter(pk=options['session_id']).first()
        if not session:
            raise CommandError('Session not found.')

        with tempfile.TemporaryDirectory(prefix=f'practica-session-{session.id}-') as tmpdir:
            tmp_path = Path(tmpdir)
            source_path = tmp_path / Path(session.video_file.name or 'source').name
            output_path = tmp_path / f'session-{session.id}-proxy.mp4'

            with default_storage.open(session.video_file.name, 'rb') as source_file:
                with open(source_path, 'wb') as local_source:
                    for chunk in iter(lambda: source_file.read(1024 * 1024), b''):
                        if not chunk:
                            break
                        local_source.write(chunk)

            command = [
                'ffmpeg',
                '-y',
                '-i',
                str(source_path),
                '-map',
                '0:v:0',
                '-map',
                '0:a:0?',
                '-dn',
                '-sn',
                '-movflags',
                '+faststart',
                '-pix_fmt',
                'yuv420p',
                '-c:v',
                'libx264',
                '-preset',
                'veryfast',
                '-crf',
                '23',
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                str(output_path),
            ]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode != 0 or not output_path.exists():
                error = (result.stderr or result.stdout or 'ffmpeg failed').strip()
                apply_processing_update(
                    session,
                    Session.STATUS_FAILED,
                    error=f'Local transcoding failed: {error[:1500]}',
                )
                raise CommandError(error)

            proxy_key = f'processed/sessions/{session.id}/proxy/{output_path.name}'
            with open(output_path, 'rb') as built_file:
                saved_key = default_storage.save(proxy_key, File(built_file, name=output_path.name))

            metadata = {
                'source': 'local_ffmpeg',
                'original_object_key': session.video_file.name,
                'bytes': output_path.stat().st_size,
            }
            apply_processing_update(
                session,
                Session.STATUS_READY,
                assets=[{
                    'asset_type': SessionAsset.TYPE_PROXY_MP4,
                    'object_key': saved_key,
                    'content_type': 'video/mp4',
                    'metadata_json': metadata,
                }],
            )
            self.stdout.write(json.dumps({'session_id': session.id, 'status': 'ready', 'proxy_key': saved_key}))
