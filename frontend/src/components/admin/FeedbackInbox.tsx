import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { getAdminInbox } from '@/services/feedback';
import { listSpaces } from '@/services/spaces';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

export function FeedbackInbox() {
  const navigate = useNavigate();
  const [spaceFilter, setSpaceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'open' | 'resolved' | 'archived'>('');

  const { data: spacesData } = useQuery({
    queryKey: ['spaces-for-feedback'],
    queryFn: () => listSpaces(undefined, 100),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['feedback-inbox', spaceFilter, statusFilter],
    queryFn: () =>
      getAdminInbox({
        spaceId: spaceFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const threads = data?.items ?? [];

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'default' as const;
      case 'resolved':
        return 'success' as const;
      case 'archived':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Space</Label>
          <Select value={spaceFilter} onValueChange={setSpaceFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="All spaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All spaces</SelectItem>
              {spacesData?.items.map((space) => (
                <SelectItem key={space.spaceId} value={space.spaceId}>
                  {space.spaceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Thread list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No feedback threads</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customer feedback will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card
              key={thread.threadId}
              className="cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() =>
                navigate(
                  `/admin/spaces/${thread.spaceId}/reports/${thread.reportId}?thread=${thread.threadId}`,
                )
              }
            >
              <CardContent className="flex items-start gap-4 py-4">
                <Avatar name={thread.createdByName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold truncate">{thread.subject}</h4>
                    {thread.unreadByAdmin && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {thread.createdByName} &middot; {thread.spaceName} &middot;{' '}
                    {thread.reportName}
                  </p>
                  {thread.latestMessagePreview && (
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {thread.latestMessagePreview}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={statusBadgeVariant(thread.status)} className="text-xs">
                    {thread.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {data?.hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline">Load More</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
