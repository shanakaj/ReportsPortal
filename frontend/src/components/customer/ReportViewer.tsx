import { useRef, useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getReport } from '@/services/reports';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionExpiredOverlay } from '@/components/common/SessionExpiredOverlay';
import { useAnalyticsBridge } from '@/hooks/useAnalyticsBridge';
import { useAuth } from '@/hooks/useAuth';

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

  // Monitor iframe for 403 (session expiry)
  useEffect(() => {
    if (!data) return;

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
          onClick={() => window.open(`/report/${spaceId}/${reportId}`, '_blank')}
        >
          <ExternalLink className="mr-1 h-3 w-3" />
          Open Full Tab
        </Button>
      </div>

      <iframe
        ref={iframeRef}
        src={data.cloudFrontUrl}
        className="h-full w-full rounded-md border"
        sandbox="allow-scripts allow-same-origin"
        title={data.report.fileName}
      />
    </div>
  );
}
