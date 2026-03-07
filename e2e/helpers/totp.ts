import * as OTPAuth from 'otpauth';

/**
 * Generate a TOTP code from a base32-encoded secret.
 * Compatible with Cognito's TOTP MFA setup.
 */
export function generateTotpCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'ReportPortal',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}
