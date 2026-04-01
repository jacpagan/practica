#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/audit-aws-key.sh AKIA... [--days 14]
# Requires AWS CLI v2 and (optionally) jq for nicer summaries.

KEY_ID="${1:-}"
DAYS=14
if [[ -z "$KEY_ID" ]]; then
  echo "Usage: $0 <ACCESS_KEY_ID> [--days N]" >&2
  exit 1
fi
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) DAYS="${2:-14}"; shift 2;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

echo "== AccessKey: $KEY_ID =="

echo "-- Last used (IAM) --"
aws iam get-access-key-last-used --access-key-id "$KEY_ID" || true

START_TIME=$(date -u -v-"${DAYS}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${DAYS} days" +%Y-%m-%dT%H:%M:%SZ)

echo "-- Recent CloudTrail events (${DAYS}d) --"
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="$KEY_ID" \
  --start-time "$START_TIME" \
  --max-results 50 |
  sed -e 's/\"/"/g' || true

if command -v jq >/dev/null 2>&1; then
  echo "-- Top services (CloudTrail) --"
  aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="$KEY_ID" \
    --start-time "$START_TIME" \
    --max-results 500 \
    --output json \
    | jq -r '.Events[] | .EventSource' | sed 's/\.amazonaws\.com$//' | sort | uniq -c | sort -nr | head -20

  echo "-- Top source IPs --"
  aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=AccessKeyId,AttributeValue="$KEY_ID" \
    --start-time "$START_TIME" \
    --max-results 500 \
    --output json \
    | jq -r '.Events[] | try (.CloudTrailEvent | fromjson | .sourceIPAddress) catch empty' | sort | uniq -c | sort -nr | head -20
fi

echo "-- GuardDuty findings (if enabled) --"
DET=$(aws guardduty list-detectors --query 'DetectorIds[0]' --output text 2>/dev/null || true)
if [[ -n "$DET" && "$DET" != "None" ]]; then
  aws guardduty list-findings --detector-id "$DET" --finding-criteria '{"Criterion":{"resource.accessKeyDetails.accessKeyId":{"Eq":["'"$KEY_ID"'"]}}}' --output json || true
else
  echo "GuardDuty not configured in current account/region or no permission."
fi

echo "-- Recommendation --"
echo "If keys were ever exposed publicly or CloudTrail shows unexpected services/regions/IPs, rotate immediately."

