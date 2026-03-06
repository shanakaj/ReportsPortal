import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Plus } from 'lucide-react';
import { listThreads } from '@/services/feedback';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackThread } from '@/components/feedback/FeedbackThread';
import { FeedbackComposer } from '@/components/feedback/FeedbackComposer';
import { useAuth } from '@/hooks/useAuth';
import { Role, type FeedbackThread as FeedbackThreadType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface FeedbackPanelProps {
  spaceId: string;
  reportId: string;
  className?: string;
}

export function FeedbackPanel({ spaceId, reportId, className }: FeedbackPanelProps) {
  const { user, isReadOnly } = useAuth();
  const isAdmin = user?.role === Role.SUPER_ADMIN || user?.role === Role.ADMIN;
  const [selectedThread, setSelectedThread] = useState<FeedbackThreadType | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['feedback-threads', spaceId, reportId],
    queryFn: () => listThreads(spaceId, reportId),
  });

  const threads = data?.items ?? [];

  if (selectedThread) {
    return (
      <div className={className}>
        <FeedbackThread
          thread={selectedThread}
          onBack={() => {
            setSelectedThread(null);
            refetch();
          }}
        />
      </div>
    );
  }

  if (showComposer) {
    return (
      <div className={className}>
        <FeedbackComposer
          spaceId={spaceId}
          reportId={reportId}
          onCreated={() => {
            setShowComposer(false);
            refetch();
          }}
          onCancel={() => setShowComposer(false)}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-sm font-semibold">Feedback</h3>
        {!isReadOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowComposer(true)}>
            <Plus className="mr-1 h-3 w-3" />
            New Thread
          </Button>
        )}
      </div>

      <div className="overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No feedback yet.</p>
            {!isReadOnly && (
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => setShowComposer(true)}
              >
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div>
            {threads.map((thread) => {
              const hasUnread = isAdmin ? thread.unreadByAdmin : thread.unreadByCustomer;
              return (
                <div
                  key={thread.threadId}
                  className="border-b px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setSelectedThread(thread)}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium flex-1 truncate">
                      {thread.subject}
                    </h4>
                    {hasUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={
                        thread.status === 'open'
                          ? 'outline'
                          : thread.status === 'resolved'
                            ? 'success'
                            : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {thread.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {thread.messageCount} msg
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(thread.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
