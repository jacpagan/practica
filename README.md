# Practica

Practica is a Django + React application for private async video feedback, evolving into a teacher-led private platform for async music instruction.

The shipped product already supports:

- a private student video library,
- upload and in-app recording,
- authenticated private review flows,
- video-first feedback replies,
- and playback processing for review-ready sessions.

The v2 product direction is to serve independent drum teachers and their existing students with a lightweight teacher workflow: structured review requests, teacher inbox, roster, and repeat feedback cycles.

## Product Docs

- `docs/practica-v2-prd.md`: strategic source of truth for Practica v2.
- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline and product model.
- `docs/flow-audit.md`: implementation audit and v2 foundation gaps.
- `docs/README.md`: documentation index.

## Product Positioning

### Current shipped foundation

Practica is currently strongest as a private async video feedback tool:

- students upload or record videos into a private library,
- owners create private feedback links,
- reviewers log in and respond with video feedback,
- and feedback stays attached to the original source video.

### V2 strategic direction

Practica v2 is a teacher-led private platform for async music instruction.

Strategic decisions:

- start with existing teacher-student relationships,
- focus the wedge on independent drum teachers,
- keep student archives private and student-owned,
- build teacher workflow before marketplace discovery,
- and optimize for completed review cycles: `submission -> feedback -> resubmission`.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python virtualenv for local backend work
- Node.js and npm for local frontend work
- AWS CLI and Terraform for infra or production work

### Local Development

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

## Architecture

### Backend

- Django 4.2 + Django REST Framework
- SQLite in development and PostgreSQL in production
- S3-backed uploads when `AWS_STORAGE_BUCKET_NAME` is set
- Media processing pipeline for playback-ready sessions

### Frontend

- React 18 + Vite
- Tailwind CSS
- Route-driven SPA around library, upload, session detail, and review surfaces
- Shared upload utilities for regular and multipart upload flows

### Infrastructure

- Terraform under `infra/`
- Docker-based local development
- EC2 deploy path through `scripts/deploy-via-ssm.sh`

## Project Structure

```text
practica/
├── apps/
│   ├── backend/          # Django API and domain logic
│   └── frontend/         # React app
├── docs/                 # Product and implementation docs
├── infra/                # Terraform and infra configs
├── scripts/              # Dev and deploy scripts
├── docker-compose.yml    # Local development
└── requirements.txt      # Python dependencies
```

## Deployment Notes

- `scripts/dev.sh`: local Docker helper commands.
- `scripts/deploy-via-ssm.sh`: production deploy to EC2 via AWS SSM.
- `scripts/branch-audit.sh`: compare remote branches against a base branch.

Deployment strategy:

- `main` is the production branch.
- Deployment contract is `feature branch -> PR -> main -> production`.
- Backup, smoke checks, and rollback remain part of the production flow.

## Monitoring And Security

- Health checks are built into Docker Compose.
- Product metrics are defined in `docs/practica-v2-prd.md`.
- Local development uses SQLite by default.
- Sensitive values belong in environment variables, not in git.

## License

Personal use only unless explicitly relicensed.
