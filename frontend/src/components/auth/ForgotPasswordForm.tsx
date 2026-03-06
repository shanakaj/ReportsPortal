import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword, confirmForgotPassword } from '@/services/auth';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z
  .object({
    code: z.string().min(1, 'Verification code is required'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

interface ForgotPasswordFormProps {
  onSuccess: () => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  const handleSendCode = async (values: EmailFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await forgotPassword(values.email);
      setEmail(values.email);
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (values: ResetFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await confirmForgotPassword(email, values.code, values.newPassword);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={emailForm.handleSubmit(handleSendCode)} className="space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Reset Password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email address and we will send you a verification code.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...emailForm.register('email')}
          />
          {emailForm.formState.errors.email && (
            <p className="text-sm text-destructive">
              {emailForm.formState.errors.email.message}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Enter Verification Code</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A verification code has been sent to {email}.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Verification Code</Label>
        <Input id="code" type="text" {...resetForm.register('code')} />
        {resetForm.formState.errors.code && (
          <p className="text-sm text-destructive">
            {resetForm.formState.errors.code.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...resetForm.register('newPassword')}
        />
        {resetForm.formState.errors.newPassword && (
          <p className="text-sm text-destructive">
            {resetForm.formState.errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...resetForm.register('confirmPassword')}
        />
        {resetForm.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {resetForm.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </Button>
    </form>
  );
}
