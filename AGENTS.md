# Repository Guidelines

## Cost and usage (agents must follow)

- **Default:** Keep Cursor/agent usage, remote Cloud agents, and paid external APIs **as low as practical** unless the user explicitly opts into higher cost.
- Prefer **local Worktree** (or on-machine) work over **Cloud** agents when either can do the job; use Cloud mainly for async or when the local machine cannot run the task.
- Minimize redundant tool use, parallel subagents, and new billable integrations; do not add paid services without explicit approval.
- This complements concise communication: prefer shorter, evidence-dense updates over verbose narration.

## Product Direction

Use `docs/practica-v2-prd.md` as the strategic source of truth for product-facing work.

Important product context:

- Practica uses a member-first identity model with a teacher workflow layer for async music instruction.
- The initial wedge is independent drum teachers working with their existing students inside trusted networks.
- The current shipped foundation remains the private member-owned library plus authenticated review flows described in `docs/platform-effects-mvp-playbook.md`.
- Preserve `private by default`, `member-owned archive`, and `video-first feedback` as core product principles.
- Prioritize teacher workflow primitives next: `ReviewRequest`, teacher inbox, roster, designated-teacher permissions, and reusable templates.
- Optimize for completed review cycles: `submission -> feedback -> resubmission`.
- Keep `teacher` and `student` as workflow-context labels, not global account identity types.
- Do not introduce public marketplace mechanics, public discovery, heavy school-workspace abstractions, streaks, or practice-plan systems unless the user explicitly asks for that strategy shift.

## Documentation Source Of Truth

- `docs/practica-v2-prd.md`: v2 product requirements and roadmap direction.
- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline.
- `docs/flow-audit.md`: implementation and foundation gaps.

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

For product terminology and naming in new code or docs:

- Prefer identity terms like `member`, `session owner`, and `reviewer` for global product language.
- Prefer workflow terms like `teacher`, `student`, `review request`, `teacher inbox`, and `roster` when discussing structured teaching workflows.
- Keep `review link` or `share link` terminology only where you are explicitly touching the shipped v1 access flow.

## Testing Guidelines

Backend tests use Django’s test runner and live in `apps/backend/videos/tests/` with names like `test_auth_onboarding.py`. Add tests near the feature you change and name test methods by behavior. For frontend changes, at minimum run `npm run build` to catch integration issues, since no dedicated frontend test suite is configured here.

## TDD Expectations

- Protect the core product loop first: `upload -> playback-ready -> trusted feedback request -> reviewer inbox -> response -> follow-up take`.
- Treat the following as protected flows: upload reliability, playback, private-link access, formal review requests, reviewer inbox, feedback submission, follow-up continuation, and permissions.
- For bugs in protected flows, write or update a focused regression test before or alongside the fix.
- Before refactoring a protected area, add characterization coverage for the current behavior you intend to preserve.
- Do not mix unrelated refactors with bug fixes in protected flows.
- If a production hotfix is applied outside normal git flow, backport it into the repository immediately.
- Use `scripts/test-core-loop.sh` as the default local gate for core-loop work.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects with prefixes like `Fix:`, `Feature:`, `Perf:`, and `UI:`. Keep commit messages focused on one change, for example: `Fix: guard review page for missing session`. PRs should include a concise summary, note migrations or env changes, link relevant issues, and attach screenshots for visible UI updates.

## Security & Configuration Tips

Local development uses SQLite by default; unset `DATABASE_URL` if Django tries PostgreSQL unexpectedly. When `AWS_STORAGE_BUCKET_NAME` is set, uploads go to S3 instead of local `media/`. Never commit secrets; keep environment-specific values in local env files or GitHub Actions secrets.
