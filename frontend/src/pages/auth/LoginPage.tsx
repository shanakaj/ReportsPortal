import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { MfaForm } from '@/components/auth/MfaForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMfa, challenge, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already authenticated
  if (user) {
    const target = user.role === Role.CUSTOMER ? '/customer' : '/admin';
    navigate(target, { replace: true });
    return null;
  }

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.challenge?.challengeName === 'NEW_PASSWORD_REQUIRED') {
        navigate('/first-login');
      } else if (result.challenge?.challengeName === 'MFA_SETUP') {
        navigate('/mfa-setup');
      } else if (result.tokens && result.user) {
        const target = result.user.role === Role.CUSTOMER ? '/customer' : '/admin';
        navigate(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (code: string) => {
    if (!challenge) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyMfa(
        code,
        challenge.challengeName as 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA',
      );
      if (result.tokens && result.user) {
        const target = result.user.role === Role.CUSTOMER ? '/customer' : '/admin';
        navigate(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{import.meta.env.VITE_APP_NAME || 'Report Portal'}</CardTitle>
        </CardHeader>
        <CardContent>
          {challenge?.challengeName === 'SOFTWARE_TOKEN_MFA' ||
          challenge?.challengeName === 'SMS_MFA' ? (
            <MfaForm
              onSubmit={handleMfaVerify}
              isLoading={isLoading}
              error={error}
              mfaType={challenge.challengeName}
            />
          ) : (
            <>
              <LoginForm
                onSubmit={handleLogin}
                isLoading={isLoading}
                error={error}
              />
              <div className="mt-4 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
