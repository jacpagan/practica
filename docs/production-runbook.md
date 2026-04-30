# Practica Production Runbook

Use this when you need to verify or recover the production stack without stepping through the full release checklist.

## What Production Assumes

- The app runs with `DEBUG=false`.
- Django serves the frontend bundle from `apps/frontend/dist`.
- Production storage uses S3 when `AWS_STORAGE_BUCKET_NAME` is set.
- Production media processing should use `VIDEO_PROCESSING_MODE=mediaconvert`.
- Local ffmpeg is a fallback path, not the preferred production path.

## Required Environment

Set these before the backend starts:

- `DJANGO_SECRET_KEY`
- `DATABASE_URL` or `DB_NAME` plus `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `ALLOWED_HOSTS`
- `CORS_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_S3_REGION_NAME`
- `AWS_MEDIA_CONVERT_ROLE_ARN`
- `AWS_MEDIA_CONVERT_ENDPOINT_URL`
- `AWS_MEDIA_CONVERT_QUEUE_ARN`
- `AWS_MEDIA_CONVERT_OUTPUT_PREFIX`
- `MEDIA_PROCESSING_CALLBACK_TOKEN`
- `VIDEO_PROCESSING_MODE`
- `APP_BASE_URL`
- `EMAIL_NOTIFICATIONS_ENABLED`
- `DEFAULT_FROM_EMAIL`
- `EMAIL_BACKEND`
- `EMAIL_HOST` and optional `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS` or `EMAIL_USE_SSL`
- `DEPLOYED_GIT_SHA`

Helpful but optional:

- `UPLOAD_MAX_BYTES`
- `FILE_UPLOAD_MAX_MEMORY_SIZE`
- `ADMIN_URL`

## Launch Checks

Before calling a deploy healthy, verify:

```bash
curl -fsS https://practica.jpagan.com/health/
curl -fsS https://practica.jpagan.com/ready/
curl -fsS https://practica.jpagan.com/version
```

Expected:

- `/health/` returns `healthy`
- `/ready/` returns `ready`
- `video_processing.configured_mode` matches the intended production mode
- `deployed_sha` matches the commit you deployed
- `services.database` is healthy
- `checks.frontend_bundle` is ready

If `/ready/` is failing, check the frontend bundle and database first.

## Verify Upload

Walk one real upload path end to end:

1. Open the upload or recorder flow in the live app.
2. Upload a short video.
3. Confirm the session is created and lands in `processing`.
4. Confirm the session becomes `ready` without manual intervention.
5. Confirm playback works in the session detail page.

If the upload is large, confirm multipart upload is used and completes successfully.

## Verify Processing

Watch the session until it becomes playback-ready:

- `processing` means the backend accepted the take and is still working on it.
- `ready` means the session can be played and shared.
- `failed` means the processing backend needs attention or retry.

For MediaConvert-backed production, confirm the session produces a processing completion path and the derived assets are present.

For local ffmpeg fallback, confirm the backend is intentionally running in `local_ffmpeg` mode and that ffmpeg is installed on the host.

## Verify Review Flow

After a take is ready:

1. Create a share link or review request from session detail.
2. Open the private review link as the reviewer.
3. Submit feedback.
4. Mark the request viewed on the owner side.
5. Launch a follow-up take if the loop continues.

Expected request states:

- `requested`
- `opened`
- `responded`
- `viewed`
- `resubmitted`

## Recovery Steps

### If a session is stuck in `processing`

1. Check whether the configured processing backend is healthy.
2. Inspect the session detail response for `processing_error` and `processing_job_id`.
3. If the session is terminally failed, use `POST /api/sessions/:id/retry-processing/`.
4. Recheck `/api/sessions/:id/` until the session is `ready`.

### If share creation fails

1. Confirm the session is `ready`.
2. Confirm the owner is authenticated.
3. Check the session detail response for `processing_status`.
4. Retry after processing completes if the session is still changing state.

### If a review link or review request fails

1. Confirm the link has not been revoked or expired.
2. Confirm the reviewer or owner is authenticated.
3. Check whether the reviewer is still on the roster or invite chain.
4. Inspect the review request status before making any manual changes.

### If production health fails

1. Check `DEPLOYED_GIT_SHA` and the deploy logs first.
2. Check database connectivity.
3. Check that the frontend bundle exists on the host.
4. Check that the configured S3 and MediaConvert settings are present.

## Logs To Inspect First

Start with these in order:

1. Backend runtime logs for `ProductEvent` and request logs.
2. Deploy output for the validation gate.
3. Media processing logs for session enqueue or failure.
4. Review workflow logs for request creation, open, response, and follow-up.

Useful log signatures:

- `ProductEvent event_name=session_processing_started`
- `ProductEvent event_name=session_processing_failed`
- `ProductEvent event_name=session_share_created`
- `ProductEvent event_name=review_request_created`
- `ProductEvent event_name=review_request_responded`
- `ProductEvent event_name=review_request_notification_sent`

## Don’t Do This

- Don’t ship a production change without verifying `/health/` and `/ready/`.
- Don’t treat local ffmpeg as the default production plan unless that is explicitly the deployment mode.
- Don’t manually edit session or review state in the database unless you are recovering from an incident and have exhausted the API path.

## Related Docs

- [docs/release-checklist.md](/Users/josepagan/Documents/Code/practica/docs/release-checklist.md)
- [docs/technical-prd-2026-04-06.md](/Users/josepagan/Documents/Code/practica/docs/technical-prd-2026-04-06.md)
- [docs/platform-engineering-charter-2026-04-06.md](/Users/josepagan/Documents/Code/practica/docs/platform-engineering-charter-2026-04-06.md)
