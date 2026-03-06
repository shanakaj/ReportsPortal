import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpaceList } from '@/components/admin/SpaceList';
import { CreateSpaceDialog } from '@/components/admin/CreateSpaceDialog';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export function SpacesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { isReadOnly } = useAuth();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Spaces</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer spaces and their reports.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Space
          </Button>
        )}
      </div>

      <SpaceList />

      <CreateSpaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['spaces'] })}
      />
    </div>
  );
}
