import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Archive } from 'lucide-react';
import { getThreadMessages, replyToThread, updateThreadStatus } from '@/services/feedback';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextEditor } from '@/components/feedback/RichTextEditor';
import { AttachmentUpload } from '@/components/feedback/AttachmentUpload';
import { useAuth } from '@/hooks/useAuth';
import { Role, type FeedbackThread as FeedbackThreadType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface FeedbackThreadProps {
  thread: FeedbackThreadType;
  onBack: () => void;
}

export function FeedbackThread({ thread, onBack }: FeedbackThreadProps) {
  const { user, isReadOnly } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === Role.SUPER_ADMIN || user?.role === Role.ADMIN;
  const [replyContent, setReplyContent] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [isReplying, setIsReplying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['thread-messages', thread.threadId],
    queryFn: () => getThreadMessages(thread.threadId),
  });

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setIsReplying(true);
    try {
      await replyToThread(thread.threadId, replyContent, attachmentIds);
      setReplyContent('');
      setAttachmentIds([]);
      queryClient.invalidateQueries({ queryKey: ['thread-messages', thread.threadId] });
    } catch {
      // Handle error
    } finally {
      setIsReplying(false);
    }
  };

  const handleStatusChange = async (status: 'resolved' | 'archived') => {
    await updateThreadStatus(thread.threadId, status);
    queryClient.invalidateQueries({ queryKey: ['thread-messages', thread.threadId] });
  };

  const roleBadgeVariant = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN:
        return 'destructive' as const;
      case Role.ADMIN:
        return 'default' as const;
      case Role.CUSTOMER:
        return 'secondary' as const;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={onBack} className="rounded-md p-1 hover:bg-accent">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-semibold text-sm flex-1">{thread.subject}</h3>
          <Badge
            variant={
              thread.status === 'open'
                ? 'default'
                : thread.status === 'resolved'
                  ? 'success'
                  : 'secondary'
            }
          >
            {thread.status}
          </Badge>
        </div>
        {isAdmin && !isReadOnly && thread.status === 'open' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('resolved')}
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('archived')}
            >
              <Archive className="mr-1 h-3 w-3" />
              Archive
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : (
          data?.items.map((message) => (
            <div key={message.messageId} className="flex gap-3">
              <Avatar name={message.authorName} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{message.authorName}</span>
                  <Badge variant={roleBadgeVariant(message.authorRole)} className="text-[10px]">
                    {message.authorRole === Role.SUPER_ADMIN
                      ? 'Admin'
                      : message.authorRole}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div
                  className="mt-1 text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: message.message }}
                />
                {message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((att) => (
                      <a
                        key={att.attachmentId}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        {att.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply form */}
      {!isReadOnly && thread.status !== 'archived' && (
        <div className="border-t p-4 space-y-3">
          <RichTextEditor
            content={replyContent}
            onChange={setReplyContent}
            placeholder="Write a reply..."
          />
          <div className="flex items-center justify-between">
            <AttachmentUpload
              threadId={thread.threadId}
              onUploaded={(id) => setAttachmentIds((prev) => [...prev, id])}
              disabled={isReplying}
            />
            <Button onClick={handleReply} disabled={isReplying || !replyContent.trim()}>
              {isReplying ? 'Sending...' : 'Reply'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
