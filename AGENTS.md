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

## Delivery Agents (Roles)

- Release Agent: Owns merging to `main` and versioning. Checks that CI is green and the PR includes migration notes.
- Deploy Agent (CI): On push to `main`, SSHes into the server and runs `docker-compose -f docker-compose.prod.yml up -d --build`. Performs a health check on `/health/`.
- Infra Agent: Maintains DNS, TLS, and reverse proxy. Ensures `ALLOWED_HOSTS`, `CORS_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` include `practica.jpagan.com`. Manages S3 bucket policy/CORS when used.
- Dev Agent (Local): Runs `make up`, `make migrate`, `make createsuperuser`. Verifies new features locally at `localhost:3000` before pushing.
- Observability Agent: Monitors container logs, sets alarms, and checks `/health/` and key API endpoints.

### Rules of Engagement

- Local-first: All features are verified locally (Docker Compose) before PR.
- Main = Production: Merging to `main` triggers the deploy workflow to the production server.
- Idempotent deploys: Production compose commands can be run multiple times safely.
- Health gate: Deployment considered successful only if `/health/` returns 200 over HTTPS.
- Media storage: Production uses S3 (recommended). If not, reverse proxy must serve `/media/` with range requests enabled.

### Required Secrets (GitHub → Settings → Secrets and variables → Actions)

- `SSH_HOST`: Server public hostname/IP
- `SSH_USER`: SSH username
- `SSH_PORT` (optional, default 22)
- `SSH_KEY`: Private key (PEM). Ensure the public key is on the server.
- `SSH_PROJECT_DIR`: Absolute path on server where the repo lives (e.g., `/opt/practica`)
- `ENV_PRODUCTION` (optional): Contents of `.env.production` with env vars (DEBUG=0, ALLOWED_HOSTS, API_URL, SECRET_KEY, POSTGRES_PASSWORD, AWS_* if using S3)

### Server Prereqs

- Docker and docker-compose installed
- Nginx reverse proxy terminating TLS for `practica.jpagan.com`
- If using S3: bucket CORS allows GET/HEAD with range requests and origins set to site domain

