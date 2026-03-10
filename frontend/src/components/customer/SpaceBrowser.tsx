import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen } from 'lucide-react';
import { listCustomerSpaces } from '@/services/spaces';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SpaceBrowser() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-spaces'],
    queryFn: listCustomerSpaces,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const spaces = data?.items ?? [];

  if (spaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No spaces available</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You have not been assigned to any spaces yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {spaces.map((space) => (
        <Card
          key={space.spaceId}
          data-testid="customer-space-card"
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => navigate(`/customer/spaces/${space.spaceId}`)}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{space.spaceName}</h3>
              <p className="text-sm text-muted-foreground">
                {space.reportCount ?? 0} report{(space.reportCount ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
