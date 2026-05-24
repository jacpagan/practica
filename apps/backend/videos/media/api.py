import math
import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from botocore.exceptions import BotoCoreError, ClientError

from videos.models import MultipartSessionUpload, Session
from videos.serializers import SessionSerializer
from videos.services.media_pipeline import apply_processing_update
from .security import processing_callback_authorized
from .services import normalized_client_upload_id, start_processing_pipeline
from .uploads import (
    attach_tags_to_session,
    direct_uploads_enabled,
    list_uploaded_parts,
    opaque_video_storage_key,
    parse_tag_names,
    parse_timing_metadata,
    recommended_part_size,
    s3_client,
    sanitize_filename,
)

logger = logging.getLogger(__name__)


def _upload_error(message, *, code, http_status):
    return Response({'error': message, 'code': code}, status=http_status)


def _multipart_initiate_existing_response(upload, request):
    if upload.status == MultipartSessionUpload.STATUS_INITIATED:
        if upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])
            return _upload_error(
                'Previous upload expired. Restart upload to continue.',
                code='upload_restart_required',
                http_status=status.HTTP_409_CONFLICT,
            )
        part_size = recommended_part_size(upload.size_bytes)
        total_parts = math.ceil(upload.size_bytes / part_size)
        return Response(
            {
                'multipart_upload_id': upload.id,
                'part_size': part_size,
                'total_parts': total_parts,
                'expires_at': upload.expires_at,
                'status': upload.status,
            },
            status=status.HTTP_200_OK,
        )

    if upload.status == MultipartSessionUpload.STATUS_COMPLETED and upload.session_id:
        session = get_object_or_404(Session, pk=upload.session_id, user=request.user)
        serializer = SessionSerializer(session, context={'request': request})
        return Response(
            {
                'multipart_upload_id': upload.id,
                'status': upload.status,
                'session': serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    return _upload_error(
        'Previous upload is no longer resumable. Restart upload to continue.',
        code='upload_restart_required',
        http_status=status.HTTP_409_CONFLICT,
    )


class SessionMediaActionsMixin:
    @action(detail=False, methods=['post'], url_path='multipart/initiate')
    def multipart_initiate(self, request):
        if not direct_uploads_enabled():
            return _upload_error('Direct uploads are not configured', code='direct_uploads_not_configured', http_status=status.HTTP_400_BAD_REQUEST)

        title = str(request.data.get('title', '')).strip()
        if not title:
            return _upload_error('Title is required', code='upload_title_required', http_status=status.HTTP_400_BAD_REQUEST)

        client_upload_id = normalized_client_upload_id(request.data.get('client_upload_id'))
        if client_upload_id:
            existing_upload = MultipartSessionUpload.objects.filter(user=request.user, client_upload_id=client_upload_id).first()
            if existing_upload:
                return _multipart_initiate_existing_response(existing_upload, request)

        try:
            size_bytes = int(request.data.get('size_bytes', 0))
        except (TypeError, ValueError):
            return _upload_error('Invalid file size', code='upload_invalid_file_size', http_status=status.HTTP_400_BAD_REQUEST)
        if size_bytes <= 0:
            return _upload_error('Invalid file size', code='upload_invalid_file_size', http_status=status.HTTP_400_BAD_REQUEST)

        max_bytes = int(getattr(settings, 'UPLOAD_MAX_BYTES', 2147483648))
        if size_bytes > max_bytes:
            return _upload_error('File exceeds max upload size (2GB)', code='upload_size_exceeded', http_status=status.HTTP_400_BAD_REQUEST)

        content_type = str(request.data.get('content_type', '')).strip().lower()
        from videos.video_uploads import is_allowed_video_upload

        if not is_allowed_video_upload(content_type, request.data.get('filename')):
            return _upload_error('Only video files allowed', code='upload_invalid_video_type', http_status=status.HTTP_400_BAD_REQUEST)

        filename = sanitize_filename(request.data.get('filename'))
        key = opaque_video_storage_key(user_id=request.user.id, filename=filename)
        part_size = recommended_part_size(size_bytes)
        total_parts = math.ceil(size_bytes / part_size)

        try:
            raw_duration_seconds = request.data.get('duration_seconds', '')
            if raw_duration_seconds is None or str(raw_duration_seconds).strip().lower() in {'', 'none', 'null'}:
                duration_seconds = None
            else:
                duration_seconds = int(raw_duration_seconds)
        except (TypeError, ValueError):
            return _upload_error('Invalid duration', code='upload_invalid_duration', http_status=status.HTTP_400_BAD_REQUEST)

        tags_csv = ','.join(parse_tag_names(request.data.get('tags', [])))
        timing_metadata = parse_timing_metadata(request.data.get('timing_metadata'))
        expires_at = timezone.now() + timezone.timedelta(hours=24)

        try:
            create_kwargs = {
                'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                'Key': key,
            }
            if content_type:
                create_kwargs['ContentType'] = content_type
            resp = s3_client().create_multipart_upload(**create_kwargs)
        except (BotoCoreError, ClientError):
            return _upload_error('Could not start multipart upload', code='upload_initiate_failed', http_status=status.HTTP_502_BAD_GATEWAY)

        try:
            upload = MultipartSessionUpload.objects.create(
                user=request.user,
                status=MultipartSessionUpload.STATUS_INITIATED,
                title=title,
                practice_series=str(request.data.get('practice_series', '')).strip(),
                description=str(request.data.get('description', '')).strip(),
                reference_title=str(request.data.get('reference_title', '')).strip(),
                reference_url=str(request.data.get('reference_url', '')).strip(),
                tags_csv=tags_csv,
                duration_seconds=duration_seconds,
                timing_metadata=timing_metadata,
                original_filename=filename,
                content_type=content_type,
                client_upload_id=client_upload_id,
                size_bytes=size_bytes,
                s3_key=key,
                s3_upload_id=resp['UploadId'],
                expires_at=expires_at,
            )
        except IntegrityError:
            if not client_upload_id:
                raise
            existing_upload = MultipartSessionUpload.objects.filter(user=request.user, client_upload_id=client_upload_id).first()
            if existing_upload:
                return _multipart_initiate_existing_response(existing_upload, request)
            raise

        return Response({
            'multipart_upload_id': upload.id,
            'part_size': part_size,
            'total_parts': total_parts,
            'expires_at': upload.expires_at,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='multipart/status')
    def multipart_status(self, request):
        if not direct_uploads_enabled():
            return _upload_error('Direct uploads are not configured', code='direct_uploads_not_configured', http_status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return _upload_error('Invalid multipart upload', code='upload_invalid_multipart_id', http_status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status == MultipartSessionUpload.STATUS_INITIATED and upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])

        part_size = recommended_part_size(upload.size_bytes)
        total_parts = math.ceil(upload.size_bytes / part_size)
        uploaded_parts = []

        if upload.status == MultipartSessionUpload.STATUS_INITIATED:
            try:
                uploaded_parts = list_uploaded_parts(upload, client=s3_client())
            except ClientError as exc:
                code = str(exc.response.get('Error', {}).get('Code', ''))
                if code == 'NoSuchUpload':
                    upload.status = MultipartSessionUpload.STATUS_EXPIRED
                    upload.save(update_fields=['status'])
                    return _upload_error('Upload session no longer exists', code='upload_expired', http_status=status.HTTP_410_GONE)
                return _upload_error('Could not fetch multipart upload status', code='upload_status_unavailable', http_status=status.HTTP_502_BAD_GATEWAY)
            except BotoCoreError:
                return _upload_error('Could not fetch multipart upload status', code='upload_status_unavailable', http_status=status.HTTP_502_BAD_GATEWAY)

        if upload.status == MultipartSessionUpload.STATUS_COMPLETED and upload.session_id:
            session = get_object_or_404(Session, pk=upload.session_id, user=request.user)
            serializer = SessionSerializer(session, context={'request': request})
            return Response({
                'multipart_upload_id': upload.id,
                'status': upload.status,
                'session': serializer.data,
            })

        return Response({
            'multipart_upload_id': upload.id,
            'status': upload.status,
            'expires_at': upload.expires_at,
            'size_bytes': upload.size_bytes,
            'part_size': part_size,
            'total_parts': total_parts,
            'uploaded_parts': uploaded_parts,
        })

    @action(detail=False, methods=['post'], url_path='multipart/sign-part')
    def multipart_sign_part(self, request):
        if not direct_uploads_enabled():
            return _upload_error('Direct uploads are not configured', code='direct_uploads_not_configured', http_status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
            part_number = int(request.data.get('part_number'))
        except (TypeError, ValueError):
            return _upload_error('Invalid multipart upload or part number', code='upload_invalid_part_request', http_status=status.HTTP_400_BAD_REQUEST)
        if part_number <= 0:
            return _upload_error('Part number must be greater than 0', code='upload_invalid_part_number', http_status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status != MultipartSessionUpload.STATUS_INITIATED:
            return _upload_error('Upload is not open', code='upload_not_open', http_status=status.HTTP_400_BAD_REQUEST)
        if upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])
            return _upload_error('Upload has expired', code='upload_expired', http_status=status.HTTP_400_BAD_REQUEST)

        try:
            signed_url = s3_client().generate_presigned_url(
                ClientMethod='upload_part',
                Params={
                    'Bucket': settings.AWS_STORAGE_BUCKET_NAME,
                    'Key': upload.s3_key,
                    'UploadId': upload.s3_upload_id,
                    'PartNumber': part_number,
                },
                ExpiresIn=3600,
                HttpMethod='PUT',
            )
        except (BotoCoreError, ClientError):
            return _upload_error('Could not sign upload part', code='upload_sign_part_failed', http_status=status.HTTP_502_BAD_GATEWAY)

        return Response({'signed_url': signed_url})

    @action(detail=False, methods=['post'], url_path='multipart/complete')
    def multipart_complete(self, request):
        if not direct_uploads_enabled():
            return _upload_error('Direct uploads are not configured', code='direct_uploads_not_configured', http_status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return _upload_error('Invalid multipart upload', code='upload_invalid_multipart_id', http_status=status.HTTP_400_BAD_REQUEST)

        raw_parts = request.data.get('parts', [])
        if not isinstance(raw_parts, list) or not raw_parts:
            return _upload_error('Parts are required', code='upload_parts_required', http_status=status.HTTP_400_BAD_REQUEST)

        parts = []
        for part in raw_parts:
            if not isinstance(part, dict):
                return _upload_error('Invalid part payload', code='upload_invalid_part_payload', http_status=status.HTTP_400_BAD_REQUEST)
            try:
                part_number = int(part.get('part_number'))
            except (TypeError, ValueError):
                return _upload_error('Invalid part number', code='upload_invalid_part_number', http_status=status.HTTP_400_BAD_REQUEST)
            etag = str(part.get('etag', '')).strip()
            if part_number <= 0 or not etag:
                return _upload_error('Each part needs part_number and etag', code='upload_invalid_part_etag', http_status=status.HTTP_400_BAD_REQUEST)
            parts.append({'PartNumber': part_number, 'ETag': etag})

        parts = sorted(parts, key=lambda p: p['PartNumber'])

        with transaction.atomic():
            upload = get_object_or_404(
                MultipartSessionUpload.objects.select_for_update(),
                pk=upload_id,
                user=request.user,
            )
            if upload.status != MultipartSessionUpload.STATUS_INITIATED:
                if upload.status == MultipartSessionUpload.STATUS_COMPLETED and upload.session_id:
                    session = get_object_or_404(Session, pk=upload.session_id, user=request.user)
                    serializer = SessionSerializer(session, context={'request': request})
                    return Response(serializer.data, status=status.HTTP_200_OK)
                return _upload_error('Upload is not open', code='upload_not_open', http_status=status.HTTP_400_BAD_REQUEST)
            if upload.expires_at < timezone.now():
                upload.status = MultipartSessionUpload.STATUS_EXPIRED
                upload.save(update_fields=['status'])
                return _upload_error('Upload has expired', code='upload_expired', http_status=status.HTTP_400_BAD_REQUEST)

            try:
                s3_client().complete_multipart_upload(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=upload.s3_key,
                    UploadId=upload.s3_upload_id,
                    MultipartUpload={'Parts': parts},
                )
            except (BotoCoreError, ClientError):
                return _upload_error('Could not finalize multipart upload', code='upload_finalize_failed', http_status=status.HTTP_502_BAD_GATEWAY)

            session = Session.objects.create(
                user=request.user,
                title=upload.title,
                practice_series=upload.practice_series,
                description=upload.description,
                reference_title=upload.reference_title,
                reference_url=upload.reference_url,
                video_file=upload.s3_key,
                duration_seconds=upload.duration_seconds,
                timing_metadata=upload.timing_metadata,
            )
            attach_tags_to_session(session, upload.tags_csv)

            upload.status = MultipartSessionUpload.STATUS_COMPLETED
            upload.completed_at = timezone.now()
            upload.session = session
            upload.save(update_fields=['status', 'completed_at', 'session'])

        start_processing_pipeline(session)
        serializer = SessionSerializer(session, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='multipart/abort')
    def multipart_abort(self, request):
        if not direct_uploads_enabled():
            return _upload_error('Direct uploads are not configured', code='direct_uploads_not_configured', http_status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return _upload_error('Invalid multipart upload', code='upload_invalid_multipart_id', http_status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status != MultipartSessionUpload.STATUS_INITIATED:
            return Response({'status': upload.status})

        try:
            s3_client().abort_multipart_upload(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=upload.s3_key,
                UploadId=upload.s3_upload_id,
            )
        except (BotoCoreError, ClientError):
            pass

        upload.status = MultipartSessionUpload.STATUS_ABORTED
        upload.save(update_fields=['status'])
        return Response({'status': 'aborted'})

    @action(detail=True, methods=['post'], url_path='processing-update', permission_classes=[AllowAny])
    def processing_update(self, request, pk=None):
        if not processing_callback_authorized(request):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(Session, pk=pk)
        next_status = str(request.data.get('status', '')).strip().lower()
        processing_error = str(request.data.get('processing_error', '')).strip()
        assets = request.data.get('assets', [])
        if not isinstance(assets, list):
            return Response({'error': 'assets must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            apply_processing_update(
                session=session,
                status=next_status,
                error=processing_error,
                assets=assets,
            )
            if next_status in {Session.STATUS_READY, Session.STATUS_FAILED}:
                session.processing_job_id = ''
                session.save(update_fields=['processing_job_id', 'updated_at'])
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('Failed processing update for session_id=%s', session.id)
            return Response({'error': 'Could not apply processing update'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(SessionSerializer(session, context={'request': request}).data)
