# Production Workflow Implementation (Deprecated Staging Guidance)

This document was previously staging-oriented and is now superseded for active deployment policy.

## Canonical Release Strategy

- Official strategy: `main -> production` only.
- No active staging promotion path in CI/CD.
- Source of truth for release behavior: `AGENTS.md` (Release Strategy section) and production workflows in `.github/workflows/`.

## Operational Guardrails

- Keep production deploy triggers restricted to `push` on `main`.
- Run `scripts/check-release-strategy.sh` in CI to prevent drift.
- Maintain post-deploy smoke checks (`/health/`, login, upload/playback).

## If Strategy Changes Later

If the team intentionally reintroduces staging, update all of the following in one change:

1. `AGENTS.md` release strategy section.
2. `.github/workflows/*` deploy triggers.
3. `.cursor/rules.yaml` deployment rules.
4. This document.
