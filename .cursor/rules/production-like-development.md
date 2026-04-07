# Local dev parity (replaces old staging-heavy workflow doc)

**Goal:** Develop against the same stack the repo supports (Docker: Postgres, Redis, backend, frontend). See **`Makefile`** (`make up`, `make down`, `make migrate`).

**Not in use:** Separate staging compose files and “promote staging → prod” flows described in older templates. Shipping policy is **`main` → production** per `AGENTS.md` and `.cursor/rules/early-stage-production-first.mdc`.

**Guardrail:** `scripts/check-release-strategy.sh` / `.github/workflows/release-strategy-guardrail.yml` — do not reintroduce stray deploy triggers without updating policy files in one change.
