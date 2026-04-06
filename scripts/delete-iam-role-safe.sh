#!/usr/bin/env bash
set -euo pipefail

# Guarded helper to detach managed policies, delete inline policies, and then delete a role.
# Use only after you've confirmed the role is unused.

ROLE_NAME="${1:-}"
if [[ -z "$ROLE_NAME" ]]; then
  echo "Usage: $0 <ROLE_NAME>" >&2
  exit 1
fi

echo "About to inspect role: $ROLE_NAME"

echo "-- Attached managed policies --"
aws iam list-attached-role-policies --role-name "$ROLE_NAME" --output table || true

echo "-- Inline policies --"
aws iam list-role-policies --role-name "$ROLE_NAME" --output table || true

echo
read -r -p "Delete role '$ROLE_NAME'? Type the exact role name to continue: " confirmation
if [[ "$confirmation" != "$ROLE_NAME" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 1
fi

while read -r policy_arn; do
  [[ -z "$policy_arn" || "$policy_arn" == "None" ]] && continue
  echo "Detaching managed policy: $policy_arn"
  aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$policy_arn"
done < <(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --query 'AttachedPolicies[].PolicyArn' --output text)

while read -r inline_name; do
  [[ -z "$inline_name" || "$inline_name" == "None" ]] && continue
  echo "Deleting inline policy: $inline_name"
  aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "$inline_name"
done < <(aws iam list-role-policies --role-name "$ROLE_NAME" --query 'PolicyNames[]' --output text)

echo "Deleting role: $ROLE_NAME"
aws iam delete-role --role-name "$ROLE_NAME"

echo "Role deleted: $ROLE_NAME"
