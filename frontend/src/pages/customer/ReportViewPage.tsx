import { useParams } from 'react-router-dom';
import { ReportViewer } from '@/components/customer/ReportViewer';
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel';

export function ReportViewPage() {
  const { spaceId, reportId } = useParams<{ spaceId: string; reportId: string }>();

  if (!spaceId || !reportId) {
    return <div className="py-8 text-center text-muted-foreground">Report not found.</div>;
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      <div className="flex-1">
        <ReportViewer spaceId={spaceId} reportId={reportId} isAdmin={false} />
      </div>
      <div className="w-80 shrink-0 rounded-md border overflow-hidden">
        <FeedbackPanel spaceId={spaceId} reportId={reportId} className="h-full flex flex-col" />
      </div>
    </div>
  );
}
