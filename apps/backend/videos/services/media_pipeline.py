import logging
import os
import shutil
import subprocess
import sys
import json
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from typing import Iterable

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.db import transaction

from videos.models import Session, SessionAsset

logger = logging.getLogger(__name__)


def local_transcode_enabled():
    return bool(shutil.which('ffmpeg'))


def media_pipeline_enabled():
    return bool(
        getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        and getattr(settings, 'AWS_MEDIA_CONVERT_ROLE_ARN', '')
        and getattr(settings, 'AWS_MEDIA_CONVERT_ENDPOINT_URL', '')
    )


def _instance_role_credentials():
    try:
        token_request = Request(
            'http://169.254.169.254/latest/api/token',
            method='PUT',
            headers={'X-aws-ec2-metadata-token-ttl-seconds': '21600'},
        )
        with urlopen(token_request, timeout=1) as token_response:
            token = token_response.read().decode('utf-8').strip()
        common_headers = {'X-aws-ec2-metadata-token': token}

        role_request = Request(
            'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
            headers=common_headers,
        )
        with urlopen(role_request, timeout=1) as role_response:
            role_name = role_response.read().decode('utf-8').strip()
        if not role_name:
            return None

        creds_request = Request(
            f'http://169.254.169.254/latest/meta-data/iam/security-credentials/{role_name}',
            headers=common_headers,
        )
        with urlopen(creds_request, timeout=1) as creds_response:
            payload = json.loads(creds_response.read().decode('utf-8'))

        access_key = str(payload.get('AccessKeyId', '')).strip()
        secret_key = str(payload.get('SecretAccessKey', '')).strip()
        token_value = str(payload.get('Token', '')).strip()
        if not access_key or not secret_key or not token_value:
            return None
        return {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'aws_session_token': token_value,
        }
    except (URLError, HTTPError, TimeoutError, ValueError, OSError, json.JSONDecodeError):
        return None


def _mediaconvert_client():
    kwargs = {
        'region_name': getattr(settings, 'AWS_S3_REGION_NAME', None),
        'endpoint_url': getattr(settings, 'AWS_MEDIA_CONVERT_ENDPOINT_URL', None),
    }
    role_credentials = _instance_role_credentials()
    if role_credentials:
        kwargs.update(role_credentials)
    return boto3.client('mediaconvert', **kwargs)


def _s3_client():
    kwargs = {
        'region_name': getattr(settings, 'AWS_S3_REGION_NAME', None),
    }
    role_credentials = _instance_role_credentials()
    if role_credentials:
        kwargs.update(role_credentials)
    return boto3.client('s3', **kwargs)


def _s3_uri_to_key(uri):
    parsed = urlparse(str(uri or '').strip())
    if parsed.scheme == 's3':
        return parsed.path.lstrip('/')
    return str(uri or '').strip().lstrip('/')


def _s3_uri_parts(uri):
    parsed = urlparse(str(uri or '').strip())
    if parsed.scheme != 's3':
        return '', ''
    return parsed.netloc, parsed.path.lstrip('/')


def _session_input_uri(session):
    name = (session.video_file.name or '').strip()
    if name.startswith('s3://'):
        return name
    return f"s3://{settings.AWS_STORAGE_BUCKET_NAME}/{name}"


def _base_output_prefix(session):
    custom_prefix = (getattr(settings, 'AWS_MEDIA_CONVERT_OUTPUT_PREFIX', '') or '').strip('/')
    if custom_prefix:
        return f"s3://{settings.AWS_STORAGE_BUCKET_NAME}/{custom_prefix}/{session.id}/"
    return f"s3://{settings.AWS_STORAGE_BUCKET_NAME}/processed/sessions/{session.id}/"


def _create_job_settings(session):
    input_uri = _session_input_uri(session)
    base = _base_output_prefix(session)
    return {
        'TimecodeConfig': {'Source': 'ZEROBASED'},
        'Inputs': [{
            'FileInput': input_uri,
            'AudioSelectors': {
                'A1': {'DefaultSelection': 'DEFAULT'},
            },
            'VideoSelector': {},
        }],
        'OutputGroups': [
            {
                'Name': 'proxy-mp4',
                'OutputGroupSettings': {
                    'Type': 'FILE_GROUP_SETTINGS',
                    'FileGroupSettings': {'Destination': f'{base}proxy/'},
                },
                'Outputs': [{
                    'NameModifier': '_proxy',
                    'ContainerSettings': {'Container': 'MP4'},
                    'VideoDescription': {
                        'CodecSettings': {
                            'Codec': 'H_264',
                            'H264Settings': {
                                'RateControlMode': 'QVBR',
                                'QvbrSettings': {'QvbrQualityLevel': 7},
                                'MaxBitrate': 3000000,
                                'GopSize': 15,
                                'GopSizeUnits': 'FRAMES',
                            },
                        },
                        'Width': 960,
                        'Height': 540,
                    },
                    'AudioDescriptions': [{
                        'AudioSourceName': 'A1',
                        'CodecSettings': {
                            'Codec': 'AAC',
                            'AacSettings': {'Bitrate': 96000, 'CodingMode': 'CODING_MODE_2_0', 'SampleRate': 48000},
                        },
                    }],
                }],
            },
            {
                'Name': 'hls-cmaf',
                'OutputGroupSettings': {
                    'Type': 'HLS_GROUP_SETTINGS',
                    'HlsGroupSettings': {
                        'Destination': f'{base}hls/',
                        'SegmentLength': 4,
                        'MinSegmentLength': 0,
                        'ManifestDurationFormat': 'FLOATING_POINT',
                    },
                },
                'Outputs': [{
                    'NameModifier': '_hls',
                    'ContainerSettings': {'Container': 'M3U8'},
                    'VideoDescription': {
                        'CodecSettings': {
                            'Codec': 'H_264',
                            'H264Settings': {
                                'RateControlMode': 'QVBR',
                                'QvbrSettings': {'QvbrQualityLevel': 7},
                                'MaxBitrate': 5000000,
                                'GopSize': 30,
                                'GopSizeUnits': 'FRAMES',
                            },
                        },
                        'Width': 1280,
                        'Height': 720,
                    },
                    'AudioDescriptions': [{
                        'AudioSourceName': 'A1',
                        'CodecSettings': {
                            'Codec': 'AAC',
                            'AacSettings': {'Bitrate': 96000, 'CodingMode': 'CODING_MODE_2_0', 'SampleRate': 48000},
                        },
                    }],
                }],
            },
            {
                'Name': 'thumb-capture',
                'OutputGroupSettings': {
                    'Type': 'FILE_GROUP_SETTINGS',
                    'FileGroupSettings': {'Destination': f'{base}thumbs/'},
                },
                'Outputs': [{
                    'NameModifier': '_thumb',
                    'ContainerSettings': {'Container': 'RAW'},
                    'VideoDescription': {
                        'CodecSettings': {
                            'Codec': 'FRAME_CAPTURE',
                            'FrameCaptureSettings': {
                                'FramerateNumerator': 1,
                                'FramerateDenominator': 2,
                                'MaxCaptures': 1000000,
                                'Quality': 80,
                            },
                        },
                        'Width': 320,
                        'Height': 180,
                    },
                }],
            },
        ],
    }


def enqueue_session_processing(session):
    """
    Submit MediaConvert job for this session.
    Returns (queued: bool, error: str, job_id: str)
    """
    if not media_pipeline_enabled():
        return False, 'Media pipeline is not configured', ''

    queue_arn = (getattr(settings, 'AWS_MEDIA_CONVERT_QUEUE_ARN', '') or '').strip()
    request = {
        'Role': settings.AWS_MEDIA_CONVERT_ROLE_ARN,
        'Settings': _create_job_settings(session),
        'UserMetadata': {
            'session_id': str(session.id),
            'source': 'practica',
        },
    }
    if queue_arn:
        request['Queue'] = queue_arn

    try:
        resp = _mediaconvert_client().create_job(**request)
    except (BotoCoreError, ClientError) as exc:
        logger.exception('MediaConvert enqueue failed for session_id=%s', session.id)
        return False, str(exc), ''

    job_id = str(resp.get('Job', {}).get('Id', '')).strip()
    return True, '', job_id


def _derive_assets_from_job(session, job):
    assets = []
    output_groups = job.get('OutputGroupDetails', []) or []

    for group in output_groups:
        playlist_paths = group.get('PlaylistFilePaths', []) or []
        for path in playlist_paths:
            key = _s3_uri_to_key(path)
            if key.endswith('.m3u8'):
                assets.append({
                    'asset_type': SessionAsset.TYPE_HLS_MASTER,
                    'object_key': key,
                    'content_type': 'application/vnd.apple.mpegurl',
                    'metadata_json': {'source': 'mediaconvert'},
                })

        output_details = group.get('OutputDetails', []) or []
        for detail in output_details:
            output_paths = detail.get('OutputFilePaths', []) or []
            for path in output_paths:
                key = _s3_uri_to_key(path)
                lower_key = key.lower()
                if lower_key.endswith('.mp4') and '/proxy/' in lower_key:
                    assets.append({
                        'asset_type': SessionAsset.TYPE_PROXY_MP4,
                        'object_key': key,
                        'content_type': 'video/mp4',
                        'metadata_json': {'source': 'mediaconvert'},
                    })
                elif lower_key.endswith('.vtt'):
                    assets.append({
                        'asset_type': SessionAsset.TYPE_THUMB_VTT,
                        'object_key': key,
                        'content_type': 'text/vtt',
                        'metadata_json': {'source': 'mediaconvert'},
                    })
                elif lower_key.endswith('.jpg') or lower_key.endswith('.jpeg'):
                    assets.append({
                        'asset_type': SessionAsset.TYPE_THUMB_SPRITE,
                        'object_key': key,
                        'content_type': 'image/jpeg',
                        'metadata_json': {'source': 'mediaconvert'},
                    })

    deduped = []
    seen_types = set()
    for asset in assets:
        if asset['asset_type'] in seen_types:
            continue
        seen_types.add(asset['asset_type'])
        deduped.append(asset)
    return deduped


def _discover_assets_from_job_outputs(job):
    output_groups = job.get('Settings', {}).get('OutputGroups', []) or []
    discovered = []

    for group in output_groups:
        settings_payload = group.get('OutputGroupSettings', {}) or {}
        destination = ''
        if settings_payload.get('Type') == 'FILE_GROUP_SETTINGS':
            destination = (settings_payload.get('FileGroupSettings') or {}).get('Destination', '')
        elif settings_payload.get('Type') == 'HLS_GROUP_SETTINGS':
            destination = (settings_payload.get('HlsGroupSettings') or {}).get('Destination', '')
        bucket, prefix = _s3_uri_parts(destination)
        if not bucket or not prefix:
            continue

        response = _s3_client().list_objects_v2(Bucket=bucket, Prefix=prefix)
        contents = response.get('Contents', []) or []
        keys = [str(item.get('Key', '')).strip() for item in contents if str(item.get('Key', '')).strip()]
        if not keys:
            continue

        name = str(group.get('Name', '') or '').strip().lower()
        if name == 'proxy-mp4':
            proxy_key = next((key for key in keys if key.lower().endswith('.mp4')), '')
            if proxy_key:
                discovered.append({
                    'asset_type': SessionAsset.TYPE_PROXY_MP4,
                    'object_key': proxy_key,
                    'content_type': 'video/mp4',
                    'metadata_json': {'source': 'mediaconvert'},
                })
        elif name == 'hls-cmaf':
            manifest_key = next((key for key in keys if key.lower().endswith('.m3u8') and '_hls' not in key.lower()), '')
            if not manifest_key:
                manifest_key = next((key for key in keys if key.lower().endswith('.m3u8')), '')
            if manifest_key:
                discovered.append({
                    'asset_type': SessionAsset.TYPE_HLS_MASTER,
                    'object_key': manifest_key,
                    'content_type': 'application/vnd.apple.mpegurl',
                    'metadata_json': {'source': 'mediaconvert'},
                })
        elif name == 'thumb-capture':
            thumb_key = next((key for key in keys if key.lower().endswith('.jpg') or key.lower().endswith('.jpeg')), '')
            if thumb_key:
                discovered.append({
                    'asset_type': SessionAsset.TYPE_THUMB_SPRITE,
                    'object_key': thumb_key,
                    'content_type': 'image/jpeg',
                    'metadata_json': {'source': 'mediaconvert'},
                })

    return discovered


@transaction.atomic
def sync_mediaconvert_session(session):
    job_id = str(getattr(session, 'processing_job_id', '') or '').strip()
    if not job_id or not media_pipeline_enabled():
        return session

    try:
        response = _mediaconvert_client().get_job(Id=job_id)
    except (BotoCoreError, ClientError):
        logger.exception('MediaConvert get_job failed for session_id=%s job_id=%s', session.id, job_id)
        return session

    job = response.get('Job', {}) or {}
    status = str(job.get('Status', '') or '').strip().upper()
    if status in {'SUBMITTED', 'INPUT_INFORMATION', 'PROGRESSING', 'STATUS_UPDATE'}:
        return session

    if status == 'COMPLETE':
        assets = _derive_assets_from_job(session, job)
        asset_types = {asset['asset_type'] for asset in assets}
        if SessionAsset.TYPE_PROXY_MP4 not in asset_types:
            assets.extend(_discover_assets_from_job_outputs(job))
        apply_processing_update(session, Session.STATUS_READY, assets=assets)
        session.processing_job_id = ''
        session.save(update_fields=['processing_job_id', 'updated_at'])
        return session

    if status in {'ERROR', 'CANCELED'}:
        error_message = str(job.get('ErrorMessage', '') or job.get('Status', '') or 'MediaConvert job failed').strip()
        apply_processing_update(session, Session.STATUS_FAILED, error=error_message[:2000])
        session.processing_job_id = ''
        session.save(update_fields=['processing_job_id', 'updated_at'])
        return session

    return session


def enqueue_local_session_transcode(session):
    if not local_transcode_enabled():
        return False, 'Local ffmpeg transcoding is not available'

    manage_py = os.path.join(settings.BASE_DIR, 'manage.py')
    command = [sys.executable, manage_py, 'transcode_session_local', str(session.id)]
    try:
        subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            cwd=str(settings.BASE_DIR),
            start_new_session=True,
            close_fds=True,
            env=os.environ.copy(),
        )
    except Exception as exc:
        logger.exception('Local transcode enqueue failed for session_id=%s', session.id)
        return False, str(exc)
    return True, ''


def _normalized_assets(assets: Iterable[dict]):
    normalized = []
    for raw in assets or []:
        if not isinstance(raw, dict):
            continue
        asset_type = str(raw.get('asset_type', '')).strip()
        object_key = str(raw.get('object_key', '')).strip()
        content_type = str(raw.get('content_type', '')).strip()
        metadata_json = raw.get('metadata_json')
        if metadata_json is None or not isinstance(metadata_json, dict):
            metadata_json = {}
        if not asset_type or not object_key:
            continue
        normalized.append({
            'asset_type': asset_type,
            'object_key': object_key,
            'content_type': content_type,
            'metadata_json': metadata_json,
        })
    return normalized


@transaction.atomic
def apply_processing_update(session, status, error='', assets=None):
    next_status = str(status or '').strip().lower()
    if next_status not in {Session.STATUS_PROCESSING, Session.STATUS_READY, Session.STATUS_FAILED}:
        raise ValueError('Invalid processing status')

    current_status = str(session.processing_status or '').strip().lower()
    allowed_transitions = {
        Session.STATUS_UPLOADED: {Session.STATUS_PROCESSING, Session.STATUS_FAILED},
        Session.STATUS_PROCESSING: {Session.STATUS_PROCESSING, Session.STATUS_READY, Session.STATUS_FAILED},
        Session.STATUS_READY: {Session.STATUS_PROCESSING, Session.STATUS_READY, Session.STATUS_FAILED},
        Session.STATUS_FAILED: {Session.STATUS_PROCESSING, Session.STATUS_FAILED},
    }
    if next_status not in allowed_transitions.get(current_status, set()):
        raise ValueError(f'Cannot move processing status from {current_status or "unknown"} to {next_status}')

    if next_status == Session.STATUS_READY:
        for asset in _normalized_assets(assets):
            SessionAsset.objects.update_or_create(
                session=session,
                asset_type=asset['asset_type'],
                defaults={
                    'object_key': asset['object_key'],
                    'content_type': asset['content_type'],
                    'metadata_json': asset['metadata_json'],
                },
            )
        has_proxy = session.assets.filter(asset_type=SessionAsset.TYPE_PROXY_MP4).exists()
        if not has_proxy:
            raise ValueError('Ready status requires at least one proxy_mp4 asset')

    session.processing_status = next_status
    session.processing_error = (error or '').strip()
    session.save(update_fields=['processing_status', 'processing_error', 'updated_at'])
    return session
