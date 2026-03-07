#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh [environment] [--skip-infra] [--watch]
# Example: ./scripts/deploy.sh dev
#          ./scripts/deploy.sh staging --skip-infra
#          ./scripts/deploy.sh prod --watch
#
# Triggers the Deploy workflow in GitHub Actions.
# Requires: gh CLI (https://cli.github.com)

ENVIRONMENT="${1:-dev}"
SKIP_INFRA=false
WATCH=false

shift || true
for arg in "$@"; do
  case "$arg" in
    --skip-infra) SKIP_INFRA=true ;;
    --watch)      WATCH=true ;;
    *)            echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "ERROR: Invalid environment '$ENVIRONMENT'. Must be dev, staging, or prod."
  exit 1
fi

# Check gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "ERROR: GitHub CLI (gh) is required. Install from https://cli.github.com"
  exit 1
fi

echo "============================================"
echo " Report Portal - Triggering Deployment"
echo " Environment: ${ENVIRONMENT}"
echo " Skip Infra:  ${SKIP_INFRA}"
echo "============================================"
echo ""

gh workflow run deploy.yml \
  -f environment="$ENVIRONMENT" \
  -f skip_infra="$SKIP_INFRA"

echo "Deploy workflow triggered successfully."
echo ""

if [ "$WATCH" == "true" ]; then
  echo "Waiting for workflow to start..."
  sleep 3
  RUN_ID=$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')
  echo "Watching run: https://github.com/$(gh repo view --json nameWithOwner --jq '.nameWithOwner')/actions/runs/${RUN_ID}"
  echo ""
  gh run watch "$RUN_ID"
else
  echo "Run 'gh run list --workflow=deploy.yml' to check status."
  echo "Or re-run with --watch to follow the workflow."
fi
