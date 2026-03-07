import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, ExternalLink, MessageSquare, FileSpreadsheet, File as FileIcon, Image, Download } from 'lucide-react';
import { listReports } from '@/services/reports';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { getFileTypeCategory, isViewableInline } from '@/lib/file-utils';

function ReportFileIcon({ fileName }: { fileName: string }) {
  const cat = getFileTypeCategory(fileName);
  switch (cat) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'spreadsheet':
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    case 'presentation':
      return <FileIcon className="h-5 w-5 text-orange-500" />;
    case 'document':
      return <FileText className="h-5 w-5 text-blue-500" />;
    case 'image':
      return <Image className="h-5 w-5 text-purple-500" />;
    default:
      return <FileText className="h-5 w-5 text-primary" />;
  }
}

interface ReportBrowserProps {
  spaceId: string;
}

export function ReportBrowser({ spaceId }: ReportBrowserProps) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-reports', spaceId],
    queryFn: () => listReports(spaceId, undefined, 20, false),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const reports = data?.items ?? [];

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No reports available</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Reports will appear here once they are uploaded by your admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const viewable = isViewableInline(report.fileName);
        return (
          <Card key={report.reportId} className="hover:border-primary/30 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ReportFileIcon fileName={report.fileName} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{report.fileName}</h4>
                    {report.hasUnreadFeedback && (
                      <MessageSquare className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(report.fileSize / 1024 / 1024).toFixed(2)} MB &middot; Uploaded{' '}
                    {formatDistanceToNow(new Date(report.uploadedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/customer/spaces/${spaceId}/reports/${report.reportId}`)
                    }
                  >
                    View
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    viewable
                      ? window.open(`/report/${spaceId}/${report.reportId}`, '_blank')
                      : window.open(report.cloudFrontUrl, '_blank')
                  }
                >
                  {viewable ? (
                    <>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Full Tab
                    </>
                  ) : (
                    <>
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
