## Scripts

Kept scripts are the ones that match the current local + production workflow.

- `scripts/dev.sh`: local Docker helper commands (`up`, `down`, `logs`, etc.).
- `scripts/audit-aws-key.sh`: read-only IAM / CloudTrail / GuardDuty audit for a specific AWS access key ID.
- `scripts/deploy-via-ssm.sh`: production deploy to EC2 via AWS SSM.
- `scripts/prod-host-maintenance.sh`: production disk/backup health report plus safe Docker cleanup.
- `scripts/prod-backup-verify.sh`: production backup creation and restore verification on the host.
- `scripts/branch-audit.sh`: inspect remote branches and compare them to a base branch (defaults to `origin/main`).

### AWS Audit Script Permissions

If you want `scripts/audit-aws-key.sh` to answer whether an old IAM access key was last used or appears in CloudTrail, the caller needs read-only permissions for:

- `iam:GetAccessKeyLastUsed`
- `iam:ListAccessKeys`
- `iam:GetUser`
- `cloudtrail:LookupEvents`
- `guardduty:ListDetectors`
- `guardduty:ListFindings`

Use `scripts/audit-aws-key-policy.json` as the minimal starting point.

For production and GitHub Actions, prefer short-lived credentials through:

- GitHub OIDC role assumption for workflows
- EC2 instance profile for the production backend host

Avoid granting these permissions to long-lived app users unless you have to; a separate audit principal is safer.

Removed legacy scripts were older staging/production orchestration and template automation flows that are no longer part of the active deployment model.
