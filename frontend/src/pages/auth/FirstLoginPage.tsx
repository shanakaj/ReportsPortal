import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FirstLoginForm } from '@/components/auth/FirstLoginForm';
import { MfaForm } from '@/components/auth/MfaForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';

export function FirstLoginPage() {
  const navigate = useNavigate();
  const { completeNewPassword, verifyMfa, challenge } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetPassword = async (newPassword: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await completeNewPassword(newPassword);
      if (result.challenge?.challengeName === 'MFA_SETUP') {
        navigate('/mfa-setup');
      } else if (result.tokens && result.user) {
        const target = result.user.role === Role.CUSTOMER ? '/customer' : '/admin';
        navigate(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password.');
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
      setError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome</CardTitle>
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
            <FirstLoginForm
              onSubmit={handleSetPassword}
              isLoading={isLoading}
              error={error}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
