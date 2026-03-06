import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ReportBrowser } from '@/components/customer/ReportBrowser';

export function ReportsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  if (!spaceId) {
    return <div className="py-8 text-center text-muted-foreground">Space not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="rounded-md p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse and view reports in this space.
          </p>
        </div>
      </div>

      <ReportBrowser spaceId={spaceId} />
    </div>
  );
}
