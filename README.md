# Practica MVP

Practica is a video-based practice accountability app built as a modular Django + React monolith.

## Quick start (out of the box)

1. `cp .env.example .env`
2. `docker compose up --build`
3. Open:
   - Web: `http://localhost:3000`
   - API root: `http://localhost:8000`
   - Health live: `http://localhost:8000/health/live/`
   - Health ready: `http://localhost:8000/health/ready/`

## Services started by compose

- `frontend` (React/Vite)
- `backend` (Django + DRF)
- `db` (PostgreSQL)
- `redis` (broker/cache)
- `celery-worker` (background jobs)
- `minio` + `minio-setup` (S3-compatible local object storage)

## Seed demo data

After stack is up:

- `docker compose exec backend python manage.py seed_mvp`

Demo accounts:

- Student: `student@practica.local` / `student123`
- Coach: `coach@practica.local` / `coach123`
- Admin: `admin@practica.local` / `admin123`

## MVP API (versioned)

All APIs are under `/api/v1`:

- Auth: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`
- Sessions: `/sessions`, `/sessions/:id`
- Uploads: `/uploads/request`, `/uploads/:id/sign-part`, `/uploads/:id/status`, `/uploads/:id/complete`, `/uploads/:id/abort`
- Comments: `/sessions/:id/comments`
- Review links: `/sessions/:id/review-links`, `/review-links/:token`, `/review-links/:token/verify-pin`, `/review-links/:token/feedback`, `/review-links/:id/revoke`
- Analytics: `/analytics/me/summary`, `/analytics/me/weekly`

## Common commands

- `make up` / `make down`
- `make logs`
- `make migrate`
- `make shell`

## Notes

- Direct uploads use multipart pre-signed URLs to S3-compatible storage (MinIO in local dev).
- Background processing is queued through Celery; local fallback processing is preserved when cloud transcoding is not configured.
- Notification sending is provider-abstracted via `NOTIFICATIONS_PROVIDER`.
