import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, X, Download } from 'lucide-react';
import { getReport } from '@/services/reports';
import { Button } from '@/components/ui/button';
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel';
import { SessionExpiredOverlay } from '@/components/common/SessionExpiredOverlay';
import { useAnalyticsBridge } from '@/hooks/useAnalyticsBridge';
import { useAuth } from '@/hooks/useAuth';
import { Role } from '@/types';
import { getFileTypeCategory, isDownloadable } from '@/lib/file-utils';

export function FullTabReportPage() {
  const { spaceId, reportId } = useParams<{ spaceId: string; reportId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const isAdmin = user?.role === Role.SUPER_ADMIN || user?.role === Role.ADMIN;

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-view-full', spaceId, reportId],
    queryFn: () => getReport(spaceId!, reportId!, isAdmin),
    enabled: !!spaceId && !!reportId,
  });

  // Set CloudFront signed cookies so the browser can access report content
  const [cookiesReady, setCookiesReady] = useState(false);
  useEffect(() => {
    if (!data?.signedCookies) return;
    Object.entries(data.signedCookies).forEach(([name, value]) => {
      document.cookie = `${name}=${value}; path=/; secure; samesite=none`;
    });
    setCookiesReady(true);
  }, [data]);

  useAnalyticsBridge({
    spaceId: spaceId!,
    reportId: reportId!,
    viewMode: 'full-tab',
    iframeRef,
    enabled: !!data && user?.analyticsConsent === true,
  });

  // Monitor for session expiry — only for HTML reports
  useEffect(() => {
    if (!data) return;
    if (getFileTypeCategory(data.report.fileName) !== 'html') return;

    const checkExpiry = () => {
      try {
        const iframe = iframeRef.current;
        if (iframe?.contentDocument) {
          const body = iframe.contentDocument.body;
          if (body && body.innerText.includes('403')) {
            setSessionExpired(true);
          }
        }
      } catch {
        // Cross-origin
      }
    };

    const interval = setInterval(checkExpiry, 30_000);
    return () => clearInterval(interval);
  }, [data]);

  if (!spaceId || !reportId) {
    return <div className="flex h-screen items-center justify-center">Report not found.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!cookiesReady && data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load report.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const portalPath = isAdmin ? '/admin' : '/customer';
  const category = getFileTypeCategory(data.report.fileName);

  const renderContent = () => {
    if (category === 'image') {
      return (
        <div className="h-full w-full overflow-auto bg-muted/30 flex items-center justify-center p-4">
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
          data-testid="report-iframe"
          src={data.cloudFrontUrl}
          className="h-full w-full border-none"
          sandbox={category === 'html' ? 'allow-scripts allow-same-origin' : undefined}
          title={data.report.fileName}
        />
      );
    }

    // Doc, Excel, PPT — not viewable in browser
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-muted/30">
        <p className="text-muted-foreground">
          This file type cannot be previewed in the browser.
        </p>
        <Button
          variant="default"
          size="lg"
          onClick={() => window.open(data.cloudFrontUrl, '_blank')}
        >
          <Download className="mr-2 h-4 w-4" />
          Download {data.report.fileName}
        </Button>
      </div>
    );
  };

  return (
    <div data-testid="full-tab-view" className="relative h-screen w-screen">
      {sessionExpired && <SessionExpiredOverlay />}

      {renderContent()}

      {/* Floating toolbar */}
      <div data-testid="floating-toolbar" className="fixed top-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-card/95 backdrop-blur border px-4 py-2 shadow-lg">
        <span className="text-sm font-medium max-w-[200px] truncate">
          {data.report.fileName}
        </span>
        <div className="h-4 w-px bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(portalPath)}
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Portal
        </Button>
        {isDownloadable(data.report.fileName) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(data.cloudFrontUrl, '_blank')}
          >
            <Download className="mr-1 h-3 w-3" />
            Download
          </Button>
        )}
        <Button
          data-testid="feedback-toggle"
          variant={showFeedback ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setShowFeedback(!showFeedback)}
        >
          <MessageSquare className="mr-1 h-3 w-3" />
          Feedback
        </Button>
      </div>

      {/* Feedback slide-out overlay */}
      {showFeedback && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowFeedback(false)}
          />
          <div className="fixed right-0 top-0 z-50 h-full w-96 bg-card border-l shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Feedback</h3>
              <button
                type="button"
                onClick={() => setShowFeedback(false)}
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FeedbackPanel
              spaceId={spaceId}
              reportId={reportId}
              className="flex-1 overflow-hidden flex flex-col"
            />
          </div>
        </>
      )}
    </div>
  );
}
