import { FeedbackInbox } from '@/components/admin/FeedbackInbox';

export function FeedbackInboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feedback Inbox</h1>
        <p className="text-muted-foreground mt-1">
          View and respond to customer feedback across all spaces.
        </p>
      </div>

      <FeedbackInbox />
    </div>
  );
}
