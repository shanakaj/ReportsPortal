import { useRef, useState, useEffect } from 'react';
import { ExternalLink, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getReport } from '@/services/reports';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionExpiredOverlay } from '@/components/common/SessionExpiredOverlay';
import { useAnalyticsBridge } from '@/hooks/useAnalyticsBridge';
import { useAuth } from '@/hooks/useAuth';
import { getFileTypeCategory, isViewableInline } from '@/lib/file-utils';

interface ReportViewerProps {
  spaceId: string;
  reportId: string;
  isAdmin?: boolean;
}

export function ReportViewer({ spaceId, reportId, isAdmin = false }: ReportViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-view', spaceId, reportId],
    queryFn: () => getReport(spaceId, reportId, isAdmin),
  });

  useAnalyticsBridge({
    spaceId,
    reportId,
    viewMode: 'embedded',
    iframeRef,
    enabled: !!data && user?.analyticsConsent === true,
  });

  // Monitor iframe for 403 (session expiry) — only for iframe-based views
  useEffect(() => {
    if (!data) return;
    const category = getFileTypeCategory(data.report.fileName);
    if (category !== 'html') return;

    const checkIframe = () => {
      try {
        const iframe = iframeRef.current;
        if (iframe?.contentDocument) {
          const body = iframe.contentDocument.body;
          if (body && body.innerText.includes('403')) {
            setSessionExpired(true);
          }
        }
      } catch {
        // Cross-origin, cannot check directly
      }
    };

    const interval = setInterval(checkIframe, 30_000);
    return () => clearInterval(interval);
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-[calc(100vh-200px)] w-full" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">
          Failed to load report. Please try again.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const category = getFileTypeCategory(data.report.fileName);
  const canViewInline = isViewableInline(data.report.fileName);

  const renderContent = () => {
    if (category === 'image') {
      return (
        <div className="h-full w-full overflow-auto rounded-md border bg-muted/30 flex items-center justify-center p-4">
          <img
            src={data.cloudFrontUrl}
            alt={data.report.fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    if (category === 'html' || category === 'pdf') {
      return (
        <iframe
          ref={iframeRef}
          src={data.cloudFrontUrl}
          className="h-full w-full rounded-md border"
          sandbox={category === 'html' ? 'allow-scripts allow-same-origin' : undefined}
          title={data.report.fileName}
        />
      );
    }

    // Doc, Excel, PPT — not viewable inline
    return (
      <div className="h-full w-full rounded-md border flex flex-col items-center justify-center gap-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          This file type cannot be previewed in the browser.
        </p>
        <Button
          variant="default"
          onClick={() => window.open(data.cloudFrontUrl, '_blank')}
        >
          <Download className="mr-2 h-4 w-4" />
          Download {data.report.fileName}
        </Button>
      </div>
    );
  };

  return (
    <div className="relative h-[calc(100vh-200px)]">
      {sessionExpired && <SessionExpiredOverlay />}

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {data.report.fileName}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(
            canViewInline
              ? `/report/${spaceId}/${reportId}`
              : data.cloudFrontUrl,
            '_blank',
          )}
        >
          <ExternalLink className="mr-1 h-3 w-3" />
          {canViewInline ? 'Open Full Tab' : 'Download'}
        </Button>
      </div>

      {renderContent()}
    </div>
  );
}
