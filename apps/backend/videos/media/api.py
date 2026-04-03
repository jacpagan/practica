import math
import logging

from django.conf import settings
from django.db import transaction
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
from .services import start_processing_pipeline
from .uploads import (
    attach_tags_to_session,
    direct_uploads_enabled,
    list_uploaded_parts,
    opaque_video_storage_key,
    parse_tag_names,
    recommended_part_size,
    s3_client,
    sanitize_filename,
)

logger = logging.getLogger(__name__)


class SessionMediaActionsMixin:
    @action(detail=False, methods=['post'], url_path='multipart/initiate')
    def multipart_initiate(self, request):
        if not direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        title = str(request.data.get('title', '')).strip()
        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            size_bytes = int(request.data.get('size_bytes', 0))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid file size'}, status=status.HTTP_400_BAD_REQUEST)
        if size_bytes <= 0:
            return Response({'error': 'Invalid file size'}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = int(getattr(settings, 'UPLOAD_MAX_BYTES', 2147483648))
        if size_bytes > max_bytes:
            return Response({'error': 'File exceeds max upload size (2GB)'}, status=status.HTTP_400_BAD_REQUEST)

        content_type = str(request.data.get('content_type', '')).strip().lower()
        from videos.video_uploads import is_allowed_video_upload

        if not is_allowed_video_upload(content_type, request.data.get('filename')):
            return Response({'error': 'Only video files allowed'}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({'error': 'Invalid duration'}, status=status.HTTP_400_BAD_REQUEST)

        tags_csv = ','.join(parse_tag_names(request.data.get('tags', [])))
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
            return Response({'error': 'Could not start multipart upload'}, status=status.HTTP_502_BAD_GATEWAY)

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
            original_filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            s3_key=key,
            s3_upload_id=resp['UploadId'],
            expires_at=expires_at,
        )

        return Response({
            'multipart_upload_id': upload.id,
            'part_size': part_size,
            'total_parts': total_parts,
            'expires_at': upload.expires_at,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='multipart/status')
    def multipart_status(self, request):
        if not direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload'}, status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status == MultipartSessionUpload.STATUS_INITIATED and upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])

        part_size = recommended_part_size(upload.size_bytes)
        total_parts = math.ceil(upload.size_bytes / part_size)
        uploaded_parts = []

        if upload.status == MultipartSessionUpload.STATUS_INITIATED:
            try:
                uploaded_parts = list_uploaded_parts(upload)
            except ClientError as exc:
                code = str(exc.response.get('Error', {}).get('Code', ''))
                if code == 'NoSuchUpload':
                    upload.status = MultipartSessionUpload.STATUS_EXPIRED
                    upload.save(update_fields=['status'])
                    return Response({'error': 'Upload session no longer exists'}, status=status.HTTP_410_GONE)
                return Response({'error': 'Could not fetch multipart upload status'}, status=status.HTTP_502_BAD_GATEWAY)
            except BotoCoreError:
                return Response({'error': 'Could not fetch multipart upload status'}, status=status.HTTP_502_BAD_GATEWAY)

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
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
            part_number = int(request.data.get('part_number'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload or part number'}, status=status.HTTP_400_BAD_REQUEST)
        if part_number <= 0:
            return Response({'error': 'Part number must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)

        upload = get_object_or_404(MultipartSessionUpload, pk=upload_id, user=request.user)
        if upload.status != MultipartSessionUpload.STATUS_INITIATED:
            return Response({'error': 'Upload is not open'}, status=status.HTTP_400_BAD_REQUEST)
        if upload.expires_at < timezone.now():
            upload.status = MultipartSessionUpload.STATUS_EXPIRED
            upload.save(update_fields=['status'])
            return Response({'error': 'Upload has expired'}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({'error': 'Could not sign upload part'}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({'signed_url': signed_url})

    @action(detail=False, methods=['post'], url_path='multipart/complete')
    def multipart_complete(self, request):
        if not direct_uploads_enabled():
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload'}, status=status.HTTP_400_BAD_REQUEST)

        raw_parts = request.data.get('parts', [])
        if not isinstance(raw_parts, list) or not raw_parts:
            return Response({'error': 'Parts are required'}, status=status.HTTP_400_BAD_REQUEST)

        parts = []
        for part in raw_parts:
            if not isinstance(part, dict):
                return Response({'error': 'Invalid part payload'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                part_number = int(part.get('part_number'))
            except (TypeError, ValueError):
                return Response({'error': 'Invalid part number'}, status=status.HTTP_400_BAD_REQUEST)
            etag = str(part.get('etag', '')).strip()
            if part_number <= 0 or not etag:
                return Response({'error': 'Each part needs part_number and etag'}, status=status.HTTP_400_BAD_REQUEST)
            parts.append({'PartNumber': part_number, 'ETag': etag})

        parts = sorted(parts, key=lambda p: p['PartNumber'])

        with transaction.atomic():
            upload = get_object_or_404(
                MultipartSessionUpload.objects.select_for_update(),
                pk=upload_id,
                user=request.user,
            )
            if upload.status != MultipartSessionUpload.STATUS_INITIATED:
                return Response({'error': 'Upload is not open'}, status=status.HTTP_400_BAD_REQUEST)
            if upload.expires_at < timezone.now():
                upload.status = MultipartSessionUpload.STATUS_EXPIRED
                upload.save(update_fields=['status'])
                return Response({'error': 'Upload has expired'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                s3_client().complete_multipart_upload(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                    Key=upload.s3_key,
                    UploadId=upload.s3_upload_id,
                    MultipartUpload={'Parts': parts},
                )
            except (BotoCoreError, ClientError):
                return Response({'error': 'Could not finalize multipart upload'}, status=status.HTTP_502_BAD_GATEWAY)

            session = Session.objects.create(
                user=request.user,
                title=upload.title,
                practice_series=upload.practice_series,
                description=upload.description,
                reference_title=upload.reference_title,
                reference_url=upload.reference_url,
                video_file=upload.s3_key,
                duration_seconds=upload.duration_seconds,
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
            return Response({'error': 'Direct uploads are not configured'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            upload_id = int(request.data.get('multipart_upload_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid multipart upload'}, status=status.HTTP_400_BAD_REQUEST)

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
