import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .media_pipeline import local_transcode_enabled


_BROWSER_SAFE_EXTENSIONS = {'mp4', 'm4v'}
_BROWSER_SAFE_CONTENT_TYPES = {
    'video/mp4',
    'application/mp4',
    'application/x-mp4',
    'audio/mp4',
}


def feedback_video_is_browser_safe(uploaded_file):
    name = str(getattr(uploaded_file, 'name', '') or '').strip().lower()
    content_type = str(getattr(uploaded_file, 'content_type', '') or '').strip().lower()
    extension = Path(name).suffix.lower().lstrip('.')
    return extension in _BROWSER_SAFE_EXTENSIONS or content_type in _BROWSER_SAFE_CONTENT_TYPES


def _storage_url_for_key(key):
    normalized_key = str(key or '').strip().lstrip('/')
    if not normalized_key:
        return ''
    try:
        raw_url = default_storage.url(normalized_key)
    except Exception:
        raw_url = normalized_key
    candidate = str(raw_url or '').strip()
    if candidate.startswith('http://') or candidate.startswith('https://') or candidate.startswith('/'):
        return candidate
    media_base = str(getattr(settings, 'MEDIA_URL', '/media/') or '/media/').strip()
    if not media_base.endswith('/'):
        media_base = f'{media_base}/'
    if media_base.startswith('http://') or media_base.startswith('https://') or media_base.startswith('/'):
        return f'{media_base}{candidate}'
    return f"/{media_base.lstrip('/')}{candidate}"


def _run_browser_transcode(source_path, output_path):
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
        '-threads',
        '1',
        '-vf',
        'scale=960:-2',
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-ac',
        '2',
        '-b:a',
        '96k',
        str(output_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0 or not output_path.exists():
        error = (result.stderr or result.stdout or 'ffmpeg failed').strip()
        raise ValueError(f'Could not convert this feedback video for browser playback: {error[:1000]}')
    return output_path


def _transcode_uploaded_feedback_video(uploaded_file):
    source_name = Path(str(getattr(uploaded_file, 'name', '') or 'feedback-video')).name
    safe_stem = Path(source_name).stem.strip() or 'feedback-video'
    target_name = f'{safe_stem[:80]}-{uuid.uuid4().hex[:12]}.mp4'

    with tempfile.TemporaryDirectory(prefix='practica-feedback-video-') as tmpdir:
        tmp_path = Path(tmpdir)
        source_path = tmp_path / source_name
        output_path = tmp_path / target_name

        with open(source_path, 'wb') as destination:
            for chunk in uploaded_file.chunks():
                if not chunk:
                    continue
                destination.write(chunk)

        _run_browser_transcode(source_path, output_path)
        return ContentFile(output_path.read_bytes(), name=target_name)


def _feedback_proxy_key(feedback):
    source_name = Path(str(getattr(feedback.feedback_video, 'name', '') or f'feedback-{feedback.id}')).name
    safe_stem = Path(source_name).stem.strip() or f'feedback-{feedback.id}'
    return f'feedback_videos/browser/{feedback.id}/{safe_stem[:80]}-browser.mp4'


def ensure_feedback_video_playback_key(feedback):
    video_field = getattr(feedback, 'feedback_video', None)
    source_key = str(getattr(video_field, 'name', '') or '').strip()
    if not source_key:
        return ''
    if feedback_video_is_browser_safe(video_field):
        return source_key

    proxy_key = _feedback_proxy_key(feedback)
    try:
        if default_storage.exists(proxy_key):
            return proxy_key
    except Exception:
        pass

    if not local_transcode_enabled():
        return source_key

    with tempfile.TemporaryDirectory(prefix=f'practica-feedback-proxy-{feedback.id}-') as tmpdir:
        tmp_path = Path(tmpdir)
        source_path = tmp_path / Path(source_key).name
        output_path = tmp_path / Path(proxy_key).name

        with default_storage.open(source_key, 'rb') as source_file:
            with open(source_path, 'wb') as destination:
                shutil.copyfileobj(source_file, destination, length=1024 * 1024)

        _run_browser_transcode(source_path, output_path)
        saved_key = default_storage.save(proxy_key, ContentFile(output_path.read_bytes(), name=output_path.name))
        return saved_key


def feedback_video_playback_url(feedback):
    return _storage_url_for_key(ensure_feedback_video_playback_key(feedback))


def prepare_feedback_video_upload(uploaded_file):
    if not uploaded_file:
        return uploaded_file

    if local_transcode_enabled():
        try:
            return _transcode_uploaded_feedback_video(uploaded_file)
        except ValueError:
            if feedback_video_is_browser_safe(uploaded_file):
                return uploaded_file
            raise

    if feedback_video_is_browser_safe(uploaded_file):
        return uploaded_file

    raise ValueError(
        'This feedback video needs browser playback conversion before Chrome and iPhone can open it, '
        'but conversion is unavailable right now. Please upload an MP4 or try again later.'
    )
