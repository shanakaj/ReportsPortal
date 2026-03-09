/**
 * Decode a JWT payload without verification.
 * Only used to extract claims like `sub` for Cognito SDK localStorage injection.
 */
export function jwtDecode(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
