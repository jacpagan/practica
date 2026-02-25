# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Practica is a video-based practice tracking platform (Django backend + React/Vite frontend). See `.cursor/rules/practika-project-overview.md` for full architecture docs.

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Backend | `source .venv/bin/activate && cd apps/backend && python manage.py runserver 0.0.0.0:8000` | 8000 | Django REST API |
| Frontend | `cd apps/frontend && npx vite --host 0.0.0.0 --port 3000` | 3000 | Vite dev server (React) |

### Key Gotchas

- **Database**: Without `DATABASE_URL` env var, Django falls back to SQLite (`apps/backend/db.sqlite3`). No PostgreSQL needed for local dev.
- **Vite proxy**: `vite.config.js` proxies `/api` requests to `http://localhost:8000`. The original Docker config pointed to `http://backend:8000` — ensure it says `localhost` for non-Docker dev.
- **CSRF**: API endpoints under `/api/` are CSRF-exempt via custom middleware (`practica/csrf_middleware.py`).
- **Redis**: The health endpoint checks Redis, but the app runs fine without it for basic development (caching is non-critical).
- **No `__init__.py`**: The `practica` and `videos` packages don't have `__init__.py` — Django still finds them via `manage.py` config, but `ruff` must be pointed at absolute paths or individual `.py` files, not bare directory names.

### Lint / Test / Build

- **Lint**: `source .venv/bin/activate && ruff check /workspace/apps/backend/practica/ /workspace/apps/backend/videos/`
- **Tests**: `source .venv/bin/activate && cd apps/backend && python manage.py test` (no tests currently exist)
- **Frontend build**: `cd apps/frontend && npx vite build`
- **Django migrations**: `source .venv/bin/activate && cd apps/backend && python manage.py migrate`

### User Rules

- Never pin Python module versions in `requirements.txt`.
