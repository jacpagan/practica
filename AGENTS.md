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

## Release Strategy (Early Stage)

- Canonical deployment path is direct commit/push to `main` followed by automatic production deploy.
- `main` is the only deployment branch.
- No active staging deployment path exists in CI by policy.
- Staging scripts in `scripts/` are local experimentation helpers only and are non-canonical.

## Delivery Agents (Roles)

- Release Agent: Owns merging to `main` and versioning. Checks that CI is green and the PR includes migration notes.
- Deploy Agent (CI): On push to `main`, runs `.github/workflows/deploy-ssm.yml` to deploy via AWS SSM. Performs required backend and public health checks.
- Infra Agent: Maintains DNS, TLS, and reverse proxy. Ensures `ALLOWED_HOSTS`, `CORS_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` include `practica.jpagan.com`. Manages S3 bucket policy/CORS when used.
- Dev Agent (Local): Runs `make up`, `make migrate`, `make createsuperuser`. Verifies new features locally at `localhost:3000` before pushing.
- Observability Agent: Monitors container logs, sets alarms, and checks `/health/` and key API endpoints.

### Rules of Engagement

- Local-first: All features are minimally verified locally (frontend build + backend check if env is available) before push.
- Main = Production: Pushes to `main` trigger the production deploy workflow.
- Idempotent deploys: Production compose commands can be run multiple times safely.
- Health gate: Deployment considered successful only if `/health/` returns 200 over HTTPS.
- Media storage: Production uses S3 (recommended). If not, reverse proxy must serve `/media/` with range requests enabled.

### Early-Stage Production-First Policy

Non-negotiable policy while Practica is in early stage:

- Direct-to-main: completed changes are committed and pushed to `main` in the same work session.
- No batching: do not hold completed changes for later release branches.
- Production verification: after each push, the deploy workflow must succeed and `https://practica.jpagan.com/health/` must return `200`.
- Fix-forward rule: if deploy fails, agents immediately push a fix to `main`; no long-lived rollback branches by default.

When this policy changes:

- Update this section, `.cursor/rules.yaml`, and `.cursor/rules/early-stage-production-first.mdc` in the same commit.
- Replace these rules with the new explicit release model (for example PR approvals, staging promotion, or release branches).

### Agent Runbook (Canonical Commands)

Use this command sequence for every completed change:

```bash
# 1) Sync local main
git checkout main
git pull --ff-only origin main

# 2) Minimum local validation gate
cd apps/frontend && npm run build && cd ../..
# Optional if backend env is available:
# source .venv/bin/activate && cd apps/backend && python manage.py check && cd ../..

# 3) Commit directly to main
git add -A
git commit -m "your change summary"
git push origin main

# 4) Watch production deploy to completion
RUN_ID="$(gh run list --workflow 'Deploy via SSM' --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$RUN_ID"

# 5) Verify production health
curl -fsS https://practica.jpagan.com/health/
```

### Required Secrets (GitHub → Settings → Secrets and variables → Actions)

- `AWS_ROLE_ARN`: OIDC-assumable IAM role for GitHub Actions deploy.
- `AWS_REGION`: AWS region for SSM deploy commands.
- `INSTANCE_ID`: Production EC2 instance ID targeted by SSM.
- `ENV_PRODUCTION`: Full `.env.production` content used by production containers.

Legacy SSH deploy secrets are deprecated for standard production deploy flow.

### Server Prereqs

- Docker and docker-compose installed
- Nginx reverse proxy terminating TLS for `practica.jpagan.com`
- If using S3: bucket CORS allows GET/HEAD with range requests and origins set to site domain
