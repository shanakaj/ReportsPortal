import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserList } from '@/components/admin/UserList';
import { InviteAdminDialog } from '@/components/admin/InviteAdminDialog';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

export function UsersPage() {
  const { user, isReadOnly } = useAuth();
  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;
  const [showInviteAdmin, setShowInviteAdmin] = useState(false);
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage admins and customers across all spaces.
          </p>
        </div>
        {isSuperAdmin && !isReadOnly && (
          <Button onClick={() => setShowInviteAdmin(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Admin
          </Button>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Users</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="admins">Admins</TabsTrigger>}
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <UserList />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="admins">
            <UserList roleFilter={Role.ADMIN} />
          </TabsContent>
        )}

        <TabsContent value="customers">
          <UserList roleFilter={Role.CUSTOMER} />
        </TabsContent>
      </Tabs>

      <InviteAdminDialog
        open={showInviteAdmin}
        onOpenChange={setShowInviteAdmin}
        onInvited={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
    </div>
  );
}
