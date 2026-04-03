import math
import uuid

import boto3
from django.conf import settings

from videos.models import Tag


def direct_uploads_enabled():
    return bool(getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''))


def s3_client():
    return boto3.client(
        's3',
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
    )


def recommended_part_size(size_bytes):
    min_part_size = 5 * 1024 * 1024
    max_parts = 10000
    part_size = max(min_part_size, math.ceil(size_bytes / max_parts))
    part_size_mb = math.ceil(part_size / (1024 * 1024))
    return part_size_mb * 1024 * 1024


def sanitize_filename(name):
    safe = (name or 'session-video.mp4').strip().replace('\\', '/').split('/')[-1]
    return safe or 'session-video.mp4'


def opaque_video_storage_key(*, user_id, filename, prefix='sessions'):
    safe_name = sanitize_filename(filename)
    extension = ''
    if '.' in safe_name:
        extension = f".{safe_name.rsplit('.', 1)[-1].lower()}"
    return f"{prefix}/{user_id}/{uuid.uuid4().hex}{extension}"


def list_uploaded_parts(upload, client=None):
    client = client or s3_client()
    parts = []
    marker = None
    while True:
        params = {
            'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
            'Key': upload.s3_key,
            'UploadId': upload.s3_upload_id,
            'MaxParts': 1000,
        }
        if marker:
            params['PartNumberMarker'] = marker
        resp = client.list_parts(**params)
        for part in resp.get('Parts', []):
            parts.append({
                'part_number': part.get('PartNumber'),
                'etag': str(part.get('ETag', '')).strip(),
                'size': part.get('Size'),
            })
        if not resp.get('IsTruncated'):
            break
        marker = resp.get('NextPartNumberMarker')
        if not marker:
            break
    return parts


def parse_tag_names(raw_tags):
    if isinstance(raw_tags, str):
        return [t.strip() for t in raw_tags.split(',') if t.strip()]
    if isinstance(raw_tags, list):
        return [str(t).strip() for t in raw_tags if str(t).strip()]
    return []


def attach_tags_to_session(session, raw_tags):
    for name in parse_tag_names(raw_tags):
        tag, _ = Tag.objects.get_or_create(name__iexact=name, defaults={'name': name})
        session.tags.add(tag)
