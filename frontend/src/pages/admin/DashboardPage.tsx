import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Users, FileText, MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listSpaces } from '@/services/spaces';
import { listUsers } from '@/services/users';
import { getUnreadFeedbackCount } from '@/services/feedback';
import { useAuth } from '@/hooks/useAuth';

export function DashboardPage() {
  const { user } = useAuth();

  const { data: spacesData, isLoading: spacesLoading } = useQuery({
    queryKey: ['dashboard-spaces'],
    queryFn: () => listSpaces(undefined, 1),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: () => listUsers({ limit: 1 }),
  });

  const { data: feedbackCount, isLoading: feedbackLoading } = useQuery({
    queryKey: ['dashboard-feedback-count'],
    queryFn: getUnreadFeedbackCount,
  });

  const stats = [
    {
      label: 'Customer Spaces',
      value: spacesData?.items.length ?? 0,
      icon: <FolderOpen className="h-5 w-5" />,
      loading: spacesLoading,
    },
    {
      label: 'Total Users',
      value: usersData?.items.length ?? 0,
      icon: <Users className="h-5 w-5" />,
      loading: usersLoading,
    },
    {
      label: 'Unread Feedback',
      value: feedbackCount ?? 0,
      icon: <MessageSquare className="h-5 w-5" />,
      loading: feedbackLoading,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.fullName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className="text-muted-foreground">{stat.icon}</div>
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <a
              href="/admin/spaces"
              className="flex items-center gap-3 rounded-md border p-4 hover:bg-accent transition-colors"
            >
              <FolderOpen className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Manage Spaces</span>
            </a>
            <a
              href="/admin/users"
              className="flex items-center gap-3 rounded-md border p-4 hover:bg-accent transition-colors"
            >
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Manage Users</span>
            </a>
            <a
              href="/admin/feedback"
              className="flex items-center gap-3 rounded-md border p-4 hover:bg-accent transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Feedback Inbox</span>
            </a>
            <a
              href="/admin/analytics"
              className="flex items-center gap-3 rounded-md border p-4 hover:bg-accent transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">View Analytics</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
