import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { getSpace } from '@/services/spaces';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportList } from '@/components/admin/ReportList';
import { ReportUpload } from '@/components/admin/ReportUpload';
import { UserList } from '@/components/admin/UserList';
import { InviteCustomerDialog } from '@/components/admin/InviteCustomerDialog';
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel';
import { useAuth } from '@/hooks/useAuth';

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isReadOnly } = useAuth();
  const [showInvite, setShowInvite] = useState(false);

  const { data: space, isLoading } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => getSpace(spaceId!),
    enabled: !!spaceId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!space || !spaceId) {
    return <div className="py-8 text-center text-muted-foreground">Space not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/spaces')}
          className="rounded-md p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{space.spaceName}</h1>
          <p className="text-muted-foreground text-sm">Space ID: {spaceId}</p>
        </div>
        {!isReadOnly && (
          <Button variant="outline" onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Customer
          </Button>
        )}
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <div className="space-y-6">
            {!isReadOnly && (
              <ReportUpload
                spaceId={spaceId}
                onUploaded={() =>
                  queryClient.invalidateQueries({ queryKey: ['reports', spaceId] })
                }
              />
            )}
            <ReportList spaceId={spaceId} />
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UserList spaceId={spaceId} />
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackPanel
            spaceId={spaceId}
            reportId=""
            className="min-h-[400px] rounded-md border"
          />
        </TabsContent>
      </Tabs>

      <InviteCustomerDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        spaceId={spaceId}
        spaceName={space.spaceName}
        allowedCustomerDomains={space.allowedCustomerDomains}
        onInvited={() =>
          queryClient.invalidateQueries({ queryKey: ['users', spaceId] })
        }
      />
    </div>
  );
}
