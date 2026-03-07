import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info } from 'lucide-react';
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
import { createSpace } from '@/services/spaces';

const spaceNameSchema = z.object({
  spaceName: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Must be lowercase, alphanumeric with hyphens only (no leading/trailing hyphens)',
    ),
});

type SpaceNameFormValues = z.infer<typeof spaceNameSchema>;

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateSpaceDialog({ open, onOpenChange, onCreated }: CreateSpaceDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SpaceNameFormValues>({
    resolver: zodResolver(spaceNameSchema),
  });

  const nameValue = watch('spaceName');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toLowerCase();
    // Auto-suggest: if user types a domain, extract the name
    const domainMatch = value.match(/^([a-z0-9-]+)\.(com|com\.au|org|net|io)/);
    if (domainMatch) {
      value = domainMatch[1];
    }
    // Remove invalid characters
    value = value.replace(/[^a-z0-9-]/g, '');
    setValue('spaceName', value, { shouldValidate: true });
  };

  const handleFormSubmit = async (values: SpaceNameFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await createSpace(values.spaceName);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create space',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Customer Space</DialogTitle>
          <DialogDescription>
            Create a new isolated space for a customer. This will provision a dedicated S3 bucket.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spaceName">Space Name</Label>
            <Input
              id="spaceName"
              placeholder="e.g., woodside"
              value={nameValue || ''}
              {...register('spaceName')}
              onChange={handleInputChange}
            />
            {errors.spaceName && (
              <p className="text-sm text-destructive">{errors.spaceName.message}</p>
            )}

            <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Use a name that matches your customer&apos;s email domain base (e.g.,
                &quot;acme&quot; for @acme.com). This helps with automatic domain matching when
                inviting customers to the space.
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Space'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
