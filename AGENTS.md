# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Practica is a video-based practice tracking platform for skill learning (drumming, tai chi, cooking, etc.). Django backend + React/Vite frontend, deployed on AWS. See `.cursor/rules/practika-project-overview.md` for architecture docs.

### Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Django 6 + DRF | Token auth, REST API |
| Frontend | React 18 + Vite + Tailwind | SPA served by Django via WhiteNoise |
| Database | SQLite (dev & prod) | Single file at `apps/backend/db.sqlite3` |
| Video storage | AWS S3 (`practica-media-jpagan`) | Signed URLs, 1hr expiry |
| Hosting | EC2 t3.micro (`i-08cb49b7b159a1ff3`) | Gunicorn + Nginx + Let's Encrypt |
| DNS | Route 53 → Elastic IP 23.22.75.119 | `practica.jpagan.com` |

### Data Model

```
Session (1-hour practice recording, owned by user)
  └── Chapter (timestamped marker: "Songo at 8:00-18:00")
        └── Exercise (library entry: "Songo", auto-created from chapters)
  └── Comment (timestamped feedback, optional video reply)

Profile (student/teacher role on User)
TeacherStudent (many-to-many link via invite codes)
SessionLastSeen (unread badge tracking)
```

### Local Development

```bash
# Backend
source .venv/bin/activate
cd apps/backend && python manage.py runserver 0.0.0.0:8000

# Frontend (dev mode with hot reload)
cd apps/frontend && npx vite --host 0.0.0.0 --port 3000

# Or unified (Django serves built frontend):
cd apps/frontend && npx vite build
cd apps/backend && python manage.py collectstatic --noinput
python manage.py runserver 0.0.0.0:8000
```

### Key Gotchas

- **DATABASE_URL env var**: If set (even to empty string with PostgreSQL prefix), Django uses PostgreSQL instead of SQLite. Unset it for local dev: `DATABASE_URL= python manage.py runserver`
- **S3 storage**: When `AWS_STORAGE_BUCKET_NAME` is set, media uploads go to S3. Without it, files go to local `media/` directory. The frontend `videoUrl()` helper handles both S3 signed URLs and local `/media/` paths.
- **CSRF**: API endpoints under `/api/` are exempt via custom middleware (`practica/csrf_middleware.py`).
- **Auth required**: All API ViewSets require `IsAuthenticated`. Register/login endpoints are `AllowAny`.
- **Session filtering**: Users only see their own sessions + linked users' sessions. `_visible_user_ids()` in views.py controls this.
- **WhiteNoise**: Serves static assets in production. `WHITENOISE_ROOT` points to frontend `dist/` so `/assets/` paths resolve without `/static/` prefix.
- **Max upload**: 2GB (`DATA_UPLOAD_MAX_MEMORY_SIZE` in settings). Nginx also set to `client_max_body_size 2G`.

### Lint / Test / Build

- **Lint**: `source .venv/bin/activate && ruff check apps/backend/practica/ apps/backend/videos/`
- **Tests**: `source .venv/bin/activate && cd apps/backend && python manage.py test` (no tests currently)
- **Frontend build**: `cd apps/frontend && npx vite build`
- **Migrations**: `source .venv/bin/activate && cd apps/backend && python manage.py migrate`

### Deploying to Production

The EC2 instance pulls code packaged as a tar from S3. To deploy updates:

```bash
# 1. Build frontend
cd apps/frontend && npm install && npx vite build && cd ../..

# 2. Package
tar czf /tmp/practica-deploy.tar.gz \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='db.sqlite3' \
  --exclude='media/' --exclude='staticfiles/' --exclude='node_modules/' \
  requirements.txt apps/backend/ apps/frontend/dist/ apps/frontend/package.json \
  apps/frontend/package-lock.json apps/frontend/src/ apps/frontend/index.html \
  apps/frontend/vite.config.js apps/frontend/postcss.config.js apps/frontend/tailwind.config.js

# 3. Upload to S3
aws s3 cp /tmp/practica-deploy.tar.gz s3://practica-media-jpagan/deploy/practica-code.tar.gz

# 4. Instance must be recreated (no SSH access currently)
#    See scripts/deploy.sh for the full flow
```

Note: The EC2 instance uses SQLite, so database state is lost on instance recreation. For persistent data, migrate to RDS.

### User Rules

- Never pin Python module versions in `requirements.txt`.
