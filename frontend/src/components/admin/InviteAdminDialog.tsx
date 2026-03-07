import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { inviteAdmin } from '@/services/users';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

type InviteAdminFormValues = { email: string };

interface InviteAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

export function InviteAdminDialog({ open, onOpenChange, onInvited }: InviteAdminDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = usePlatformSettings();

  const allowedDomains = settings.allowedAdminDomains;
  const domainsStr = allowedDomains.map((d) => `@${d}`).join(', ');

  const inviteAdminSchema = z.object({
    email: z
      .string()
      .email('Please enter a valid email address')
      .refine(
        (email) => {
          const domain = email.split('@')[1]?.toLowerCase();
          return allowedDomains.some((d) => d.toLowerCase() === domain);
        },
        `Admin accounts must use one of: ${domainsStr}`,
      ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteAdminFormValues>({
    resolver: zodResolver(inviteAdminSchema),
  });

  const handleFormSubmit = async (values: InviteAdminFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await inviteAdmin(values.email);
      reset();
      onOpenChange(false);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Admin</DialogTitle>
          <DialogDescription>
            Invite a new admin to the {settings.organizationName}. Only {domainsStr} email
            addresses are permitted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder={`name@${allowedDomains[0] || 'company.com'}`}
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
      </DialogContent>
    </Dialog>
  );
}
