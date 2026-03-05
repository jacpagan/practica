## Scripts

Kept scripts are the ones that match the current local + production workflow.

- `scripts/dev.sh`: local Docker helper commands (`up`, `down`, `logs`, etc.).
- `scripts/deploy-via-ssm.sh`: production deploy to EC2 via AWS SSM.
- `scripts/branch-audit.sh`: inspect remote branches and compare them to a base branch (defaults to `origin/main`).

Removed legacy scripts were older staging/production orchestration and template automation flows that are no longer part of the active deployment model.
