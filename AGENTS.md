# Repository Guidelines

## Project Structure & Module Organization

`apps/backend/` contains the Django app and API. Core project settings live in `apps/backend/practica/`; product code, models, views, migrations, and backend tests live in `apps/backend/videos/`. `apps/frontend/` contains the React 18 + Vite SPA; reusable UI lives in `apps/frontend/src/components/` and shared helpers in `apps/frontend/src/`. Dev scripts are in `scripts/`, infrastructure code is in `infra/`, and top-level Docker and Make targets support local orchestration.

## Build, Test, and Development Commands

- `make up` / `make down`: start or stop the local Docker stack.
- `source .venv/bin/activate && cd apps/backend && python manage.py runserver 0.0.0.0:8000`: run the Django API locally.
- `cd apps/frontend && npm run dev -- --host 0.0.0.0 --port 3000`: run the Vite frontend with hot reload.
- `cd apps/frontend && npm run build`: produce the production frontend bundle.
- `source .venv/bin/activate && ruff check apps/backend/practica/ apps/backend/videos/`: lint backend Python.
- `source .venv/bin/activate && cd apps/backend && python manage.py test`: run backend tests.

## Coding Style & Naming Conventions

Use 4-space indentation in Python and standard React/JS formatting already present in the repo. Prefer descriptive names: `snake_case` for Python functions and modules, `PascalCase` for React components, and `camelCase` for frontend helpers. Keep changes focused and consistent with surrounding code. Use `ruff` for backend style checks; avoid pinning Python package versions in `requirements.txt`.

## Testing Guidelines

Backend tests use Django’s test runner and live in `apps/backend/videos/tests/` with names like `test_auth_onboarding.py`. Add tests near the feature you change and name test methods by behavior. For frontend changes, at minimum run `npm run build` to catch integration issues, since no dedicated frontend test suite is configured here.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects with prefixes like `Fix:`, `Feature:`, `Perf:`, and `UI:`. Keep commit messages focused on one change, for example: `Fix: guard review page for missing session`. PRs should include a concise summary, note migrations or env changes, link relevant issues, and attach screenshots for visible UI updates.

## Security & Configuration Tips

Local development uses SQLite by default; unset `DATABASE_URL` if Django tries PostgreSQL unexpectedly. When `AWS_STORAGE_BUCKET_NAME` is set, uploads go to S3 instead of local `media/`. Never commit secrets; keep environment-specific values in local env files or GitHub Actions secrets.
