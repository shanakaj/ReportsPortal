#!/usr/bin/env bash
# Reset a Cognito test user's password and MFA for E2E testing.
#
# This script:
#   1. Sets the user's password to a known value (permanent)
#   2. Disables MFA so the user hits MFA_SETUP on next login
#   3. The E2E test framework handles MFA_SETUP programmatically
#
# Usage:
#   ./reset-test-user.sh <user-pool-id> <email> <password>
#
# Requires: AWS CLI with appropriate Cognito permissions

set -euo pipefail

USER_POOL_ID="${1:?Usage: reset-test-user.sh <user-pool-id> <email> <password>}"
EMAIL="${2:?Usage: reset-test-user.sh <user-pool-id> <email> <password>}"
PASSWORD="${3:?Usage: reset-test-user.sh <user-pool-id> <email> <password>}"

echo "[reset-test-user] Resetting password for ${EMAIL}..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "${USER_POOL_ID}" \
  --username "${EMAIL}" \
  --password "${PASSWORD}" \
  --permanent

echo "[reset-test-user] Disabling MFA for ${EMAIL}..."
aws cognito-idp admin-set-user-mfa-preference \
  --user-pool-id "${USER_POOL_ID}" \
  --username "${EMAIL}" \
  --software-token-mfa-settings Enabled=false,PreferredMfa=false

echo "[reset-test-user] Done. User will hit MFA_SETUP on next login."
