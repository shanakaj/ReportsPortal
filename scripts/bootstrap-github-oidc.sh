#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# One-time setup: Deploy GitHub OIDC provider + deploy role
# ============================================================
#
# Prerequisites:
#   - AWS CLI configured with credentials that have IAM permissions
#   - Node.js 20+
#   - CDK CLI (npm install -g aws-cdk)
#
# Usage:
#   ./scripts/bootstrap-github-oidc.sh [environment]
#   ./scripts/bootstrap-github-oidc.sh dev
#
# After running:
#   1. Copy the DeployRoleArn from the output
#   2. Go to GitHub repo → Settings → Environments → create env (dev/staging/prod)
#   3. Add variable: AWS_DEPLOY_ROLE_ARN = <the role ARN>
#   4. Add secrets: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD (for E2E tests)
# ============================================================

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================"
echo " GitHub OIDC Bootstrap"
echo " Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Ensure CDK dependencies are installed
cd "$ROOT_DIR/infrastructure"
npm install --silent
npm run build 2>&1 | tail -1

# Bootstrap CDK (if not already done)
echo "Ensuring CDK bootstrap..."
npx cdk bootstrap --context environment="$ENVIRONMENT" 2>&1 | tail -3

# Deploy only the OIDC stack
echo ""
echo "Deploying GitHub OIDC stack..."
npx cdk deploy ReportPortal-GitHubOIDC \
  --context environment="$ENVIRONMENT" \
  --require-approval never

echo ""
echo "============================================"
echo " Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Copy the DeployRoleArn from the output above"
echo "  2. Go to: https://github.com/shanaka-versent/ReportsPortal/settings/environments"
echo "  3. Create environment: ${ENVIRONMENT}"
echo "  4. Add variable:  AWS_DEPLOY_ROLE_ARN = <role ARN>"
echo "  5. Add secret:    E2E_ADMIN_EMAIL = <test admin email>"
echo "  6. Add secret:    E2E_ADMIN_PASSWORD = <test admin password>"
echo ""
echo "Then trigger a deploy: gh workflow run deploy.yml -f environment=${ENVIRONMENT}"
echo "============================================"
