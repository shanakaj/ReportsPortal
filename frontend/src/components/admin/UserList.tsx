import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoreVertical, UserX, UserCheck, Trash2, KeyRound, Eye } from 'lucide-react';
import { listUsers, disableUser, enableUser, deleteUser, resetMfa, impersonateUser } from '@/services/users';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { Role, type User } from '@/types';
import { setTokens } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';

interface UserListProps {
  spaceId?: string;
  roleFilter?: Role;
}

export function UserList({ spaceId, roleFilter }: UserListProps) {
  const { user: currentUser, isReadOnly, setAuthFromTokens } = useAuth();
  const isSuperAdmin = currentUser?.role === Role.SUPER_ADMIN;
  const [confirmAction, setConfirmAction] = useState<{
    type: 'disable' | 'enable' | 'delete' | 'resetMfa';
    user: User;
  } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', spaceId, roleFilter],
    queryFn: () => listUsers({ spaceId, role: roleFilter }),
  });

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, user: targetUser } = confirmAction;

    switch (type) {
      case 'disable':
        await disableUser(targetUser.userId);
        break;
      case 'enable':
        await enableUser(targetUser.userId);
        break;
      case 'delete':
        await deleteUser(targetUser.userId);
        break;
      case 'resetMfa':
        await resetMfa(targetUser.userId);
        break;
    }

    setConfirmAction(null);
    refetch();
  };

  const handleImpersonate = async (userId: string) => {
    const tokens = await impersonateUser(userId);
    setAuthFromTokens({ ...tokens, refreshToken: '' });
    window.location.reload();
  };

  const getConfirmText = () => {
    if (!confirmAction) return { title: '', description: '' };
    const { type, user: targetUser } = confirmAction;
    switch (type) {
      case 'disable':
        return {
          title: 'Disable User',
          description: `Are you sure you want to disable ${targetUser.email}? They will not be able to log in.`,
        };
      case 'enable':
        return {
          title: 'Enable User',
          description: `Re-enable ${targetUser.email}? They will be able to log in again.`,
        };
      case 'delete':
        return {
          title: 'Delete User',
          description: `Permanently delete ${targetUser.email}? This action cannot be undone.`,
        };
      case 'resetMfa':
        return {
          title: 'Reset MFA',
          description: `Reset MFA for ${targetUser.email}? They will need to set up MFA again on next login.`,
        };
    }
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

  const users = data?.items ?? [];

  if (users.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No users found.
      </div>
    );
  }

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
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.userId}>
              <TableCell className="font-medium">{u.fullName}</TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={u.status === 'active' ? 'success' : 'warning'}>
                  {u.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {u.lastLogin
                  ? formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true })
                  : 'Never'}
              </TableCell>
              <TableCell>
                {!isReadOnly && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded-md p-1 hover:bg-accent">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {isSuperAdmin && (
                        <DropdownMenuItem onClick={() => handleImpersonate(u.userId)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View as
                        </DropdownMenuItem>
                      )}
                      {u.status === 'active' ? (
                        <DropdownMenuItem
                          onClick={() => setConfirmAction({ type: 'disable', user: u })}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Disable
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setConfirmAction({ type: 'enable', user: u })}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Enable
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setConfirmAction({ type: 'resetMfa', user: u })}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Reset MFA
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setConfirmAction({ type: 'delete', user: u })}
                      >
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={getConfirmText().title}
        description={getConfirmText().description}
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete' : 'Confirm'}
        variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirmAction}
      />
    </>
  );
}
