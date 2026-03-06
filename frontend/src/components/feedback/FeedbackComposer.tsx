import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/feedback/RichTextEditor';
import { createThread } from '@/services/feedback';

const threadSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject is too long'),
});

type ThreadFormValues = z.infer<typeof threadSchema>;

interface FeedbackComposerProps {
  spaceId: string;
  reportId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export function FeedbackComposer({
  spaceId,
  reportId,
  onCreated,
  onCancel,
}: FeedbackComposerProps) {
  const [messageContent, setMessageContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ThreadFormValues>({
    resolver: zodResolver(threadSchema),
  });

  const handleFormSubmit = async (values: ThreadFormValues) => {
    if (!messageContent.trim()) {
      setError('Message is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createThread(spaceId, reportId, values.subject, messageContent);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 p-4">
      <h3 className="text-sm font-semibold">New Feedback Thread</h3>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          placeholder="Brief summary of your feedback"
          {...register('subject')}
        />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Message</Label>
        <RichTextEditor
          content={messageContent}
          onChange={setMessageContent}
          placeholder="Describe your feedback in detail..."
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Thread'}
        </Button>
      </div>
    </form>
  );
}
