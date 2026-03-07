import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteCustomer } from '@/services/users';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
  allowedCustomerDomains?: string[];
  onInvited: () => void;
}

export function InviteCustomerDialog({
  open,
  onOpenChange,
  spaceId,
  spaceName,
  allowedCustomerDomains,
  onInvited,
}: InviteCustomerDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainWarning, setDomainWarning] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const { settings } = usePlatformSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
  });

  const checkDomainMismatch = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;

    // Admin domains are always allowed
    if (settings.allowedAdminDomains.some((d) => d.toLowerCase() === domain)) return false;

    // Check against space's configured allowed domains
    if (allowedCustomerDomains && allowedCustomerDomains.length > 0) {
      return !allowedCustomerDomains.some((d) => d.toLowerCase() === domain);
    }

    // Fall back to space name matching
    const emailDomainBase = domain.split('.')[0].toLowerCase();
    return emailDomainBase !== spaceName.toLowerCase();
  };

  const doInvite = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await inviteCustomer(spaceId, email);
      reset();
      setDomainWarning(false);
      setPendingEmail(null);
      onOpenChange(false);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (values: InviteFormValues) => {
    const validationMode = settings.domainValidationMode;

    if (validationMode === 'off') {
      await doInvite(values.email);
      return;
    }

    if (checkDomainMismatch(values.email)) {
      if (validationMode === 'strict') {
        setError(
          `Email domain does not match space "${spaceName}". Domain validation is set to strict mode.`,
        );
        return;
      }
      // warn mode
      setDomainWarning(true);
      setPendingEmail(values.email);
      return;
    }

    await doInvite(values.email);
  };

  const handleConfirmWarning = async () => {
    if (pendingEmail) {
      await doInvite(pendingEmail);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Customer</DialogTitle>
          <DialogDescription>
            Invite a customer to the &quot;{spaceName}&quot; space. They will receive an email
            with a registration link.
          </DialogDescription>
        </DialogHeader>

        {domainWarning ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Domain mismatch detected
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  The email domain of &quot;{pendingEmail}&quot; does not match the space name
                  &quot;{spaceName}&quot;. Are you sure you want to proceed?
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDomainWarning(false);
                  setPendingEmail(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmWarning}
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Invite Anyway'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Customer Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@company.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
