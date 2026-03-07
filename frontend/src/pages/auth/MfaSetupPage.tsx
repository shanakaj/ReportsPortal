import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';

const verifySchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain only digits'),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

export function MfaSetupPage() {
  const navigate = useNavigate();
  const { challenge, associateTotpToken, verifyTotpSetup } = useAuth();
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  useEffect(() => {
    if (challenge?.challengeName !== 'MFA_SETUP') {
      navigate('/login');
      return;
    }

    async function fetchSecret() {
      try {
        const code = await associateTotpToken();
        setSecretCode(code);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start MFA setup.');
      } finally {
        setSetupLoading(false);
      }
    }
    fetchSecret();
  }, [challenge, navigate, associateTotpToken]);

  const otpauthUri = secretCode
    ? `otpauth://totp/ReportPortal?secret=${secretCode}&issuer=ReportPortal`
    : '';

  const qrCodeUrl = secretCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`
    : '';

  const handleVerify = async (values: VerifyFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyTotpSetup(values.code);
      if (result.tokens && result.user) {
        const target = result.user.role === Role.CUSTOMER ? '/customer' : '/admin';
        navigate(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (setupLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Setting up MFA...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Set Up Authenticator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
              then enter the 6-digit code below.</p>
          </div>

          {qrCodeUrl && (
            <div className="flex justify-center">
              <img src={qrCodeUrl} alt="TOTP QR Code" width={200} height={200} />
            </div>
          )}

          {secretCode && (
            <div className="space-y-1">
              <p className="text-xs text-center text-muted-foreground">
                Or enter this key manually:
              </p>
              <p className="text-center font-mono text-sm bg-muted p-2 rounded select-all break-all">
                {secretCode}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(handleVerify)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                className="text-center text-2xl tracking-widest"
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify & Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
