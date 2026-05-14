# Repository Guidelines

## Cost and usage (agents must follow)

- **Default:** Keep Cursor/agent usage, remote Cloud agents, and paid external APIs **as low as practical** unless the user explicitly opts into higher cost.
- Prefer **local Worktree** (or on-machine) work over **Cloud** agents when either can do the job; use Cloud mainly for async or when the local machine cannot run the task.
- Minimize redundant tool use, parallel subagents, and new billable integrations; do not add paid services without explicit approval.
- This complements concise communication: prefer shorter, evidence-dense updates over verbose narration.

## Product Direction

Use `docs/practica-master-spec.md` as the strategic source of truth for product-facing work.

Important product context:

- Practica is now a private skill game built around one person, one habit or skill, and a daily proof loop.
- The current shipped foundation remains private-by-default capture, playback, and proof history.
- Preserve `private by default`, `member-owned proof archive`, `video-first capture`, and `progress-first` as core product principles.
- Prioritize the surfaces that support the loop: `Today`, `Record`, `Progress`, and proof detail.
- Optimize for a repeatable loop: `pick -> do -> record -> see progress -> repeat`.
- Keep legacy teacher/reviewer workflows dormant and secondary unless the user explicitly asks for a strategy shift back to review.
- Do not introduce public marketplace mechanics, public discovery, heavy school-workspace abstractions, or practice-plan systems unless the user explicitly asks for that strategy shift.

## Documentation Source Of Truth

- `docs/README.md`: index of product and technical docs.
- `docs/practica-master-spec.md`: current product requirements and roadmap direction.
- `docs/habits.md`: behavior and product loop memo.
- `docs/revenue-brief.md`: revenue and buyer prompt.
- `docs/tdd-strategy.md`: core-loop protection strategy.

## Project Structure & Module Organization

`apps/backend/` contains the Django app and API. Core project settings live in `apps/backend/practica/`; product code, models, views, migrations, and backend tests live in `apps/backend/videos/`. `apps/frontend/` contains the React 18 + Vite SPA; reusable UI lives in `apps/frontend/src/components/` and shared helpers in `apps/frontend/src/`. Dev scripts are in `scripts/`, infrastructure code is in `infra/`, and top-level Docker and Make targets support local orchestration.

## Build, Test, and Development Commands

- `make up` / `make down`: start or stop the local Docker stack.
- `source .venv/bin/activate && cd apps/backend && python manage.py runserver 0.0.0.0:8000`: run the Django API locally.
- `cd apps/frontend && npm run dev -- --host 0.0.0.0 --port 3000`: run the Vite frontend with hot reload.
- `cd apps/frontend && npm run build`: produce the production frontend bundle.
- `source .venv/bin/activate && ruff check apps/backend/practica/ apps/backend/videos/`: lint backend Python.
- `source .venv/bin/activate && cd apps/backend && python manage.py test`: run backend tests.

## Delivery Defaults

- Treat implementation requests as publish-intent by default: make the change, validate it, then publish the branch and open a draft PR instead of stopping at local edits.
- Prefer the repository's GitHub publish flow for this, and continue through merge or deployment when the repo's normal path is available and the user has not asked to hold back.
- Only leave work unpublished when the user explicitly asks for a local-only change, a review-only change, or when production risk requires confirmation.

## Coding Style & Naming Conventions

Use 4-space indentation in Python and standard React/JS formatting already present in the repo. Prefer descriptive names: `snake_case` for Python functions and modules, `PascalCase` for React components, and `camelCase` for frontend helpers. Keep changes focused and consistent with surrounding code. Use `ruff` for backend style checks; avoid pinning Python package versions in `requirements.txt`.

For product terminology and naming in new code or docs:

- Prefer identity terms like `member`, `skill owner`, and `proof archive` for global product language.
- Prefer workflow terms like `teacher`, `student`, `review request`, `teacher inbox`, and `roster` only when touching legacy review flows.
- Keep `review link` or `share link` terminology only where you are explicitly touching the shipped v1 access flow.

## Testing Guidelines

Backend tests use Django’s test runner and live in `apps/backend/videos/tests/` with names like `test_auth_onboarding.py`. Add tests near the feature you change and name test methods by behavior. For frontend changes, run `npm run build`; **Playwright** end-to-end tests (`npm run test:e2e` in `apps/frontend/`) also run in **`.github/workflows/frontend-ci.yml`** when frontend files change.

## TDD Expectations

- Protect the core product loop first: `pick -> do -> record -> playback-ready -> progress -> repeat`.
- Treat the following as protected flows: upload reliability, playback, proof history, progress calculation, private-share access, and permissions.
- For bugs in protected flows, write or update a focused regression test before or alongside the fix.
- Before refactoring a protected area, add characterization coverage for the current behavior you intend to preserve.
- Do not mix unrelated refactors with bug fixes in protected flows.
- If a production hotfix is applied outside normal git flow, backport it into the repository immediately.
- Use `scripts/test-core-loop.sh` as the default local gate for core-loop work.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects with prefixes like `Fix:`, `Feature:`, `Perf:`, and `UI:`. Keep commit messages focused on one change, for example: `Fix: guard review page for missing session`. PRs should include a concise summary, note migrations or env changes, link relevant issues, and attach screenshots for visible UI updates.

## Security & Configuration Tips

Local development uses SQLite by default; unset `DATABASE_URL` if Django tries PostgreSQL unexpectedly. When `AWS_STORAGE_BUCKET_NAME` is set, uploads go to S3 instead of local `media/`. Never commit secrets; keep environment-specific values in local env files or GitHub Actions secrets.
