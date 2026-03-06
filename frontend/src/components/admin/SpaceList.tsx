import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Trash2 } from 'lucide-react';
import { listSpaces, deleteSpace } from '@/services/spaces';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useState } from 'react';

export function SpaceList() {
  const navigate = useNavigate();
  const { user, isReadOnly } = useAuth();
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => listSpaces(),
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteSpace(deleteId);
    setDeleteId(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const spaces = data?.items ?? [];

  if (spaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No spaces yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Create a customer space to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Reports</TableHead>
            <TableHead>Users</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spaces.map((space) => (
            <TableRow
              key={space.spaceId}
              className="cursor-pointer"
              onClick={() => navigate(`/admin/spaces/${space.spaceId}`)}
            >
              <TableCell className="font-medium">{space.spaceName}</TableCell>
              <TableCell>
                <Badge variant={space.status === 'active' ? 'success' : 'secondary'}>
                  {space.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(space.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell>{space.reportCount ?? 0}</TableCell>
              <TableCell>{space.userCount ?? 0}</TableCell>
              <TableCell>
                {isSuperAdmin && !isReadOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(space.spaceId);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Space"
        description="Are you sure you want to delete this space? This will permanently delete all reports and user assignments. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
