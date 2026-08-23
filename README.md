# Practica

Practica is a Django + React application built around one idea:

> Practica helps a student make the time between lessons count.

The initial design partnership is intentionally specific: **Jose + Dorothy + Qigong**.

The product is strongest when it helps a teacher give a student one clear thing to practice, helps the student actually practice it between lessons, captures private video evidence, and lets the teacher use that evidence to make the next correction and lesson more valuable.

## Core Loop

1. Teacher teaches.
2. Teacher assigns a small practice, optionally with a reference video and focused cues.
3. Student sees Today's Practice.
4. Student practices and records private video evidence.
5. Practica organizes completion and progress.
6. Teacher quickly reviews relevant evidence.
7. Teacher leaves a focused correction or next-practice instruction.
8. Student practices again with that correction.

During the initial pilot, this loop is the product.

## Product Docs

- `docs/practica-master-spec.md`: single source of truth for product direction, current-state behavior, pilot, and roadmap
- `docs/habits.md`: supporting memo for practice and return loops
- `docs/revenue-brief.md`: supporting business and monetization thinking; defer to the master spec when it conflicts
- `docs/tdd-strategy.md`: focused test strategy
- `docs/local-dev-playbook.md`: cheapest safe day-to-day local development workflow
- `docs/release-checklist.md`: step-by-step release checklist from local change to production verification
- `docs/README.md`: documentation index

## Product Positioning

### Core product truth

Practica is a lightweight bridge between lessons.

The student's practice remains private by default, video stays central, teacher guidance stays lightweight, and progress comes from real practice evidence over time.

### Initial validation

The first real-world pilot is Jose + Dorothy + Qigong.

The central question is:

> Does Practica make the student practice more effectively between lessons and make the next lesson more valuable for both student and teacher?

Only after that loop works should the product generalize to additional students, teachers, and disciplines.

## What We Are Building Now

- simple teacher-assigned practice
- optional reference video and focused cues
- no-choice Today's Practice experience
- fast private recording and saving
- evidence associated with an assignment
- lightweight teacher review
- focused correction / next-practice feedback
- simple practice progress

## Not Now

- public social feeds
- followers or leaderboards
- public marketplace mechanics
- heavy LMS or school administration
- giant exercise libraries
- AI posture scoring
- automated movement judgment
- AI-first monetization

## Product Rule

Before prioritizing a feature, ask:

> Does this help Jose practice better between sessions with Dorothy, or help Dorothy teach Jose better without adding unreasonable work?

If not, it belongs in the backlog during the pilot.

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

- Django 6.x + Django REST Framework
- SQLite when running the API outside Docker without `DATABASE_URL`; PostgreSQL via Docker Compose locally and in production
- S3-backed uploads when `AWS_STORAGE_BUCKET_NAME` is set
- media processing pipeline for playback-ready sessions

### Frontend

- React 18 + Vite
- Tailwind CSS
- route-driven SPA around Today, Record, Progress, and proof/session detail surfaces

### Infrastructure

- Terraform under `infra/`
- Docker-based local development
- EC2 deploy path through GitHub Actions + `scripts/deploy-via-ssm.sh`

## Deployment Notes

- **`main`** is the production branch; completed work is integrated there (see **`AGENTS.md`** for release policy).
- Production deploys run through **`.github/workflows/deploy-ssm.yml`** (GitHub Actions → AWS SSM → EC2).
- Optional diagnostics: **`.github/workflows/debug-ssm-prod.yml`**.

## Security Notes

- Do not commit secrets.
- Prefer short-lived AWS credentials through GitHub OIDC and EC2 instance roles.
- Keep production admin on a hidden path with a strong password.

## License

Personal use only unless explicitly relicensed.
