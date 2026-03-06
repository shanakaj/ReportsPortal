import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const mfaSchema = z.object({
  code: z
    .string()
    .length(6, 'MFA code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'MFA code must contain only digits'),
});

type MfaFormValues = z.infer<typeof mfaSchema>;

interface MfaFormProps {
  onSubmit: (code: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
  mfaType: 'SOFTWARE_TOKEN_MFA' | 'SMS_MFA';
}

export function MfaForm({ onSubmit, isLoading, error, mfaType }: MfaFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
  });

  const handleFormSubmit = async (values: MfaFormValues) => {
    await onSubmit(values.code);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mfaType === 'SOFTWARE_TOKEN_MFA'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter the 6-digit code sent to your phone.'}
        </p>
      </div>

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
        {isLoading ? 'Verifying...' : 'Verify'}
      </Button>
    </form>
  );
}
