# Practica

Practica is a Django + React application built around one idea:

> Practica is a private skill game where one person does a tiny action, records proof, and sees progress over time.

The product is strongest when it helps someone:

- pick one habit or skill,
- do one small action today,
- record proof quickly,
- see effort-based progress where each saved proof matters,
- and come back tomorrow.

## Product Docs

- `docs/practica-master-spec.md`: single source of truth for product direction, current-state product behavior, and roadmap
- `docs/habits.md`: distilled habits memo for product decisions and daily skill loops
- `docs/revenue-brief.md`: business prompt for who pays, why, and what to build for revenue
- `docs/tdd-strategy.md`: focused test strategy for the proof and progress loop
- `docs/local-dev-playbook.md`: cheapest safe day-to-day local development workflow
- `docs/release-checklist.md`: step-by-step release checklist from local change to production verification
- `docs/README.md`: documentation index

## Product Positioning

### Core product truth

Practica is a private skill game.

The archive belongs to the member, the video stays central, and progress is the main product.

### Commercial shape

The first commercial offer should stay narrow:

- one member,
- one habit or skill,
- one daily proof loop.

That shape is the simplest path to a paid product.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python virtualenv for local backend work
- Node.js and npm for local frontend work
- AWS CLI and Terraform for infra or production work

### Local Development

For routine Django work, prefer the local Python + Vite loop in `docs/local-dev-playbook.md`.

Use Docker when you specifically need container, PostgreSQL, Redis, or deploy-path behavior.

1. Clone the repo and set up environment variables:

   ```bash
   git clone <your-repo>
   cd practica
   cp env.example .env
   ```

2. Start the local stack:

   ```bash
   make up
   ```

3. Access the app:

   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000`
   - Django Admin: `http://localhost:8000/admin/`

### Local Commands

```bash
# Recommended daily loop
source .venv/bin/activate && cd apps/backend && env -u DATABASE_URL -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT python manage.py runserver 127.0.0.1:8000
cd apps/frontend && npm run dev -- --host 127.0.0.1 --port 3000
source .venv/bin/activate && cd apps/backend && python manage.py check
curl -fsS http://127.0.0.1:8000/health/

# Docker workflow
make up
make down
make logs
make ps
make migrate
make createsuperuser

# Backend local dev
source .venv/bin/activate && cd apps/backend && python manage.py runserver 0.0.0.0:8000
source .venv/bin/activate && cd apps/backend && python manage.py test
source .venv/bin/activate && ruff check apps/backend/practica/ apps/backend/videos/

# Frontend local dev
cd apps/frontend && npm run dev -- --host 0.0.0.0 --port 3000
cd apps/frontend && npm run build
```

### Frontend Build Flags

- `VITE_SOURCEMAP=1` enables source maps in the built bundle.
- `VITE_MINIFY=terser` builds using Terser instead of esbuild.

### Backend Diagnostic Endpoints

- `GET /version` returns `{ sha, built_at }` for the deployed build.

## Architecture

### Backend

- Django 6.x + Django REST Framework (versions unpinned in `requirements.txt`; resolve with your venv)
- SQLite when running the API outside Docker without `DATABASE_URL`; PostgreSQL via Docker Compose locally and in production
- S3-backed uploads when `AWS_STORAGE_BUCKET_NAME` is set
- Media processing pipeline for playback-ready sessions

### Frontend

- React 18 + Vite
- Tailwind CSS
- Route-driven SPA around Today, Record, Progress, and proof detail surfaces

### Infrastructure

- Terraform under `infra/`
- Docker-based local development
- EC2 deploy path through GitHub Actions + `scripts/deploy-via-ssm.sh`

## Deployment Notes

- **`main`** is the production branch; completed work is integrated there (see **`AGENTS.md`** for release policy).
- Production deploys run through **`.github/workflows/deploy-ssm.yml`** (GitHub Actions → AWS SSM → EC2).
- Optional diagnostics: **`.github/workflows/debug-ssm-prod.yml`** (SSM shell on the prod instance; production environment).

## Security Notes

- Do not commit secrets.
- Prefer short-lived AWS credentials through GitHub OIDC and EC2 instance roles.
- Keep production admin on a hidden path with a strong password.

## License

Personal use only unless explicitly relicensed.
