import logging
from typing import Iterable

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.db import transaction

from videos.models import Session, SessionAsset

logger = logging.getLogger(__name__)


def media_pipeline_enabled():
    return bool(
        getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        and getattr(settings, 'AWS_MEDIA_CONVERT_ROLE_ARN', '')
        and getattr(settings, 'AWS_MEDIA_CONVERT_ENDPOINT_URL', '')
    )


def _mediaconvert_client():
    return boto3.client(
        'mediaconvert',
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
        endpoint_url=getattr(settings, 'AWS_MEDIA_CONVERT_ENDPOINT_URL', None),
    )


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
            'AudioSelectors': {'Audio Selector 1': {'DefaultSelection': 'DEFAULT'}},
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
                                'GopSize': 15,
                                'GopSizeUnits': 'FRAMES',
                            },
                        },
                        'Width': 960,
                        'Height': 540,
                    },
                    'AudioDescriptions': [{
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
                                'GopSize': 30,
                                'GopSizeUnits': 'FRAMES',
                            },
                        },
                        'Width': 1280,
                        'Height': 720,
                    },
                    'AudioDescriptions': [{
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
