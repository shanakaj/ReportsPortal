#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh dev
#          ./scripts/deploy.sh staging
#          ./scripts/deploy.sh prod

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================"
echo " Report Portal - Full Deployment"
echo " Environment: ${ENVIRONMENT}"
echo "============================================"

# ========== 1. Build Backend ==========
echo ""
echo "[1/5] Building backend (Java 21 + Spring Boot 3)..."
cd "$ROOT_DIR/backend"
./mvnw clean package -DskipTests -q
echo "  ✓ Backend JARs built"

# ========== 2. Build Frontend ==========
echo ""
echo "[2/5] Building frontend (React + Vite)..."
cd "$ROOT_DIR/frontend"
npm install --silent
npm run build 2>&1 | tail -3
echo "  ✓ Frontend built"

# ========== 3. CDK Synth (validate) ==========
echo ""
echo "[3/5] Validating CDK templates..."
cd "$ROOT_DIR/infrastructure"
npm install --silent
npm run build 2>&1 | tail -1
npx cdk synth --context environment="$ENVIRONMENT" --quiet 2>&1 | tail -1
echo "  ✓ CDK templates validated"

# ========== 4. CDK Deploy ==========
echo ""
echo "[4/5] Deploying all CDK stacks..."
npx cdk deploy --all \
  --context environment="$ENVIRONMENT" \
  --require-approval never \
  --outputs-file "$ROOT_DIR/cdk-outputs.json" \
  2>&1

echo "  ✓ All stacks deployed"

# ========== 5. Deploy Frontend to S3 + CloudFront Invalidation ==========
echo ""
echo "[5/5] Deploying frontend to S3 and invalidating CloudFront..."

# Extract outputs from CDK
STACK_PREFIX="ReportPortal-${ENVIRONMENT}"
SPA_BUCKET=$(jq -r ".\"${STACK_PREFIX}-Frontend\".PortalBucketName" "$ROOT_DIR/cdk-outputs.json")
DISTRIBUTION_ID=$(jq -r ".\"${STACK_PREFIX}-Frontend\".PortalDistributionId" "$ROOT_DIR/cdk-outputs.json")
CF_DOMAIN=$(jq -r ".\"${STACK_PREFIX}-Frontend\".PortalDistributionDomain" "$ROOT_DIR/cdk-outputs.json")
COGNITO_POOL_ID=$(jq -r ".\"${STACK_PREFIX}-Auth\".UserPoolId" "$ROOT_DIR/cdk-outputs.json")
COGNITO_CLIENT_ID=$(jq -r ".\"${STACK_PREFIX}-Auth\".PortalClientId" "$ROOT_DIR/cdk-outputs.json")

# Generate frontend .env.production with actual values
cat > "$ROOT_DIR/frontend/.env.production" <<EOF
VITE_API_BASE_URL=https://${CF_DOMAIN}/api
VITE_COGNITO_USER_POOL_ID=${COGNITO_POOL_ID}
VITE_COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
VITE_COGNITO_REGION=${AWS_REGION:-ap-southeast-2}
VITE_CLOUDFRONT_DOMAIN=https://${CF_DOMAIN}
EOF

# Rebuild frontend with production env
cd "$ROOT_DIR/frontend"
npm run build 2>&1 | tail -1

# Sync to S3
aws s3 sync dist/ "s3://${SPA_BUCKET}/" --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --output text \
  --query 'Invalidation.Id'

echo "  ✓ Frontend deployed to S3 and CloudFront invalidated"

# ========== Summary ==========
echo ""
echo "============================================"
echo " Deployment Complete!"
echo "============================================"
echo " Portal URL:  https://${CF_DOMAIN}"
echo " Environment: ${ENVIRONMENT}"
echo " SPA Bucket:  ${SPA_BUCKET}"
echo " Distribution: ${DISTRIBUTION_ID}"
echo "============================================"
