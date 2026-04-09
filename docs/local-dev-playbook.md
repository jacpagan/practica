# Practica Local Dev Playbook

Use this as the default low-cost workflow for day-to-day Django work.

Goal: write small backend changes locally, commit small, push to GitHub, and let GitHub Actions handle broader validation and deployment.

## Default Mode

Prefer local Django + local Vite over Docker for normal feature work.

- Use SQLite locally unless you are explicitly debugging PostgreSQL behavior.
- Keep `AWS_STORAGE_BUCKET_NAME` unset locally unless you are explicitly testing S3 uploads.
- Use `GET /health/` for normal local checks.
- Treat `GET /ready/` as a deploy-oriented check because it expects a built frontend bundle.

## tmux Layout

Use three windows or panes:

1. `backend`
2. `frontend`
3. `git`

Suggested setup:

```bash
tmux new -s practica
```

### `backend`

Run Django against local SQLite, regardless of any `.env` database settings:

```bash
cd /path/to/practica
source .venv/bin/activate
cd apps/backend
env -u DATABASE_URL -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT \
  python manage.py runserver 127.0.0.1:8000
```

Quick checks from this pane:

```bash
python manage.py check
python manage.py test videos.tests.test_health_readiness -v 2
curl -fsS http://127.0.0.1:8000/health/
```

### `frontend`

```bash
cd /path/to/practica/apps/frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

### `git`

Use this pane for small, targeted commands:

```bash
cd /path/to/practica
git status --short
git diff -- apps/backend/videos/
bash scripts/test-core-loop.sh
```

## What To Use Where

### In Codex

Use Codex for:

- small repo audits,
- focused code changes,
- targeted test selection,
- concise documentation updates,
- checking how CI or deploy is wired before touching it.

Good prompt shape:

> Change only `apps/backend/videos/...`, add or update the smallest regression test, and tell me the exact command to run locally.

Avoid using Codex for broad cleanup passes, parallel speculative work, or repeated full-repo scans when a few files are enough.

### In the shell

Use the shell for:

- running `manage.py` commands,
- hitting `/health/`,
- inspecting `git diff`,
- making small commits,
- pushing to GitHub.

Default local commands:

```bash
git status --short
source .venv/bin/activate && cd apps/backend && python manage.py check
source .venv/bin/activate && cd apps/backend && python manage.py test videos.tests.test_health_readiness -v 2
curl -fsS http://127.0.0.1:8000/health/
```

### In GitHub Actions

Leave these to GitHub Actions by default:

- backend lint in `.github/workflows/ci.yml`,
- core-loop gate in `.github/workflows/ci.yml`,
- frontend build and Playwright in `.github/workflows/frontend-ci.yml`,
- production deploy in `.github/workflows/deploy-ssm.yml`,
- production health monitoring and backup/maintenance workflows.

## Small Commit Loop

Recommended loop:

1. Start local backend and frontend.
2. Make one small Django change.
3. Run the smallest relevant Django test.
4. Check `GET /health/` if you touched app wiring or settings.
5. Review `git diff`.
6. Commit with a small focused message.
7. Push to GitHub.
8. Let GitHub Actions run broader validation.

Example:

```bash
git add apps/backend/videos apps/backend/videos/tests README.md docs/README.md docs/local-dev-playbook.md
git commit -m "Fix: guard review readiness check"
git push origin <branch>
```

## When To Use Docker

Use Docker only when you need one of these:

- PostgreSQL or Redis integration behavior,
- production-like container behavior,
- image build verification,
- deploy-path debugging.

Docker commands remain available:

```bash
make up
make down
make logs
make ps
```

But for routine Django coding, the local Python + Vite loop is cheaper, faster, and easier to reason about.

## First Commands Each Day

```bash
cd /path/to/practica
git status --short
source .venv/bin/activate
cd apps/backend && env -u DATABASE_URL -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT python manage.py runserver 127.0.0.1:8000
cd /path/to/practica/apps/frontend && npm run dev -- --host 127.0.0.1 --port 3000
curl -fsS http://127.0.0.1:8000/health/
```
