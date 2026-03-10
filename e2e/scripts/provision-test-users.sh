#!/usr/bin/env bash
# Provision test users in Cognito for E2E testing.
#
# - Creates test admin and test customer users with known passwords
# - Sets their custom:role attributes
# - Temporarily sets MFA to OPTIONAL so automated logins work
# - Disables MFA preference for all test users
# - Re-enables MFA (ON) after test run via --restore-mfa flag
#
# Usage:
#   ./provision-test-users.sh              # Provision users + disable MFA enforcement
#   ./provision-test-users.sh --restore-mfa  # Re-enable MFA enforcement after tests
#
# Requires: AWS CLI with Cognito admin permissions
# Environment: AWS_PROFILE and AWS_REGION must be set

set -euo pipefail

USER_POOL_ID="${COGNITO_USER_POOL_ID:-ap-southeast-2_nXfy13b9A}"
REGION="${AWS_REGION:-ap-southeast-2}"

SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-shanaka.jayasundera@versent.com.au}"
SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-SuperAdmin@2026!}"
TEST_ADMIN_EMAIL="${TEST_ADMIN_EMAIL:-testpr.admin@versent.com.au}"
TEST_ADMIN_PASSWORD="${TEST_ADMIN_PASSWORD:-TestAdmin@2026!}"
TEST_CUSTOMER_EMAIL="${TEST_CUSTOMER_EMAIL:-testpr.customer@example.com.au}"
TEST_CUSTOMER_PASSWORD="${TEST_CUSTOMER_PASSWORD:-TestCustomer@2026!}"

export AWS_REGION="$REGION"

# Handle --restore-mfa flag
if [[ "${1:-}" == "--restore-mfa" ]]; then
  echo "[provision] Restoring MFA enforcement (ON)..."
  aws cognito-idp set-user-pool-mfa-config \
    --user-pool-id "$USER_POOL_ID" \
    --mfa-configuration ON \
    --software-token-mfa-configuration Enabled=true
  echo "[provision] MFA enforcement restored to ON."
  exit 0
fi

create_user_if_not_exists() {
  local email="$1"
  local password="$2"
  local role="$3"
  local name="$4"

  echo "[provision] Checking if ${email} exists..."
  if aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" >/dev/null 2>&1; then
    echo "[provision] User ${email} already exists, resetting password..."
  else
    echo "[provision] Creating user ${email} with role=${role}..."
    aws cognito-idp admin-create-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$email" \
      --user-attributes \
        Name=email,Value="$email" \
        Name=email_verified,Value=true \
        Name=name,Value="$name" \
        Name=custom:role,Value="$role" \
        Name=custom:invited_by,Value="system" \
      --message-action SUPPRESS
  fi

  echo "[provision] Setting permanent password for ${email}..."
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --password "$password" \
    --permanent

  echo "[provision] Disabling MFA preference for ${email}..."
  aws cognito-idp admin-set-user-mfa-preference \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --software-token-mfa-settings Enabled=false,PreferredMfa=false 2>/dev/null || true

  echo "[provision] Done with ${email}"
}

echo "============================================"
echo " Provisioning E2E Test Users"
echo "============================================"
echo ""

# Step 1: Set MFA to OPTIONAL so automated logins work without TOTP
echo "[provision] Setting MFA to OPTIONAL for automated testing..."
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id "$USER_POOL_ID" \
  --mfa-configuration OPTIONAL \
  --software-token-mfa-configuration Enabled=true
echo "[provision] MFA set to OPTIONAL."
echo ""

# Step 2: Reset super admin password and MFA preference
echo "[provision] Resetting super admin: ${SUPER_ADMIN_EMAIL}..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$SUPER_ADMIN_EMAIL" \
  --password "$SUPER_ADMIN_PASSWORD" \
  --permanent
aws cognito-idp admin-set-user-mfa-preference \
  --user-pool-id "$USER_POOL_ID" \
  --username "$SUPER_ADMIN_EMAIL" \
  --software-token-mfa-settings Enabled=false,PreferredMfa=false 2>/dev/null || true
echo "[provision] Super admin ready."
echo ""

# Step 3: Create/reset test admin
create_user_if_not_exists "$TEST_ADMIN_EMAIL" "$TEST_ADMIN_PASSWORD" "admin" "TestPR Admin"
echo ""

# Step 4: Create/reset test customer
create_user_if_not_exists "$TEST_CUSTOMER_EMAIL" "$TEST_CUSTOMER_PASSWORD" "customer" "TestPR Customer"
echo ""

echo "============================================"
echo " All users provisioned successfully!"
echo " MFA is set to OPTIONAL for testing."
echo ""
echo " Run E2E tests now, then restore MFA with:"
echo "   ./provision-test-users.sh --restore-mfa"
echo "============================================"
