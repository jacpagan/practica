# Release workflow

**Canonical:** `AGENTS.md` and `.cursor/rules/early-stage-production-first.mdc`.

Strategy is **`main` → production** via `.github/workflows/deploy-ssm.yml`. No active staging promotion path.

Drift check: `scripts/check-release-strategy.sh` (see `.github/workflows/release-strategy-guardrail.yml`).
