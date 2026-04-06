#!/usr/bin/env bash
set -euo pipefail

# Read-only IAM footprint audit for Practica-related resources.
# Run from AWS CloudShell or any shell with valid AWS credentials.

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "== IAM Footprint Audit =="
echo "Account: $ACCOUNT_ID"
echo

echo "-- Practica/Practika/GitHub-like roles --"
aws iam list-roles --output json \
  | jq -r '
      .Roles[]
      | select(
          (.RoleName | test("practica|practika|github|ecs|mediaconvert"; "i"))
          and (.RoleName | startswith("AWSServiceRoleFor") | not)
        )
      | [.RoleName, .Arn, (.RoleLastUsed.LastUsedDate // "never"), (.RoleLastUsed.Region // "-")]
      | @tsv
    ' \
  | awk 'BEGIN { print "ROLE\tARN\tLAST_USED\tREGION" } { print }'
echo

echo "-- Practica/Practika users --"
aws iam list-users --output json \
  | jq -r '
      .Users[]
      | select(.UserName | test("practica|practika"; "i"))
      | [.UserName, .Arn, .CreateDate]
      | @tsv
    ' \
  | awk 'BEGIN { print "USER\tARN\tCREATED" } { print }'
echo

echo "-- Customer-managed policies matching Practica/Practika --"
aws iam list-policies --scope Local --output json \
  | jq -r '
      .Policies[]
      | select(.PolicyName | test("practica|practika"; "i"))
      | [.PolicyName, .Arn, .AttachmentCount, .CreateDate, .UpdateDate]
      | @tsv
    ' \
  | awk 'BEGIN { print "POLICY\tARN\tATTACHMENTS\tCREATED\tUPDATED" } { print }'
echo

echo "-- Attached entities for matching customer-managed policies --"
while IFS=$'\t' read -r policy_name policy_arn _; do
  [[ "$policy_name" == "POLICY" ]] && continue
  echo "Policy: $policy_name"
  aws iam list-entities-for-policy --policy-arn "$policy_arn" --output json \
    | jq -r '
        [
          (.PolicyUsers[]? | "  USER\t" + .UserName),
          (.PolicyRoles[]? | "  ROLE\t" + .RoleName),
          (.PolicyGroups[]? | "  GROUP\t" + .GroupName)
        ]
        | .[]
      '
done < <(
  aws iam list-policies --scope Local --output json \
    | jq -r '
        .Policies[]
        | select(.PolicyName | test("practica|practika"; "i"))
        | [.PolicyName, .Arn, .AttachmentCount]
        | @tsv
      '
)
echo

echo "-- Role trust summary for matching roles --"
aws iam list-roles --output json \
  | jq -r '
      .Roles[]
      | select(
          (.RoleName | test("practica|practika|github|ecs|mediaconvert"; "i"))
          and (.RoleName | startswith("AWSServiceRoleFor") | not)
        )
      | . as $role
      | ($role.AssumeRolePolicyDocument.Statement // [])[]?
      | [
          $role.RoleName,
          (.Principal.Federated // .Principal.Service // .Principal.AWS // "unknown"),
          .Action
        ]
      | @tsv
    ' \
  | awk 'BEGIN { print "ROLE\tTRUSTED_ENTITY\tACTION" } { print }'
echo

echo "== Suggested next manual checks =="
echo "1. Delete users with no attached policies and no access keys."
echo "2. Delete roles with old trust policies or no recent use, but only after confirming no active service depends on them."
echo "3. Tighten broad policies still attached to current roles."
