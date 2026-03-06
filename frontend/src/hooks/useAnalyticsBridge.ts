import { useEffect, useRef, useCallback } from 'react';
import { sendAnalyticsEvent } from '@/services/analytics';

interface AnalyticsBridgeOptions {
  spaceId: string;
  reportId: string;
  viewMode: 'embedded' | 'full-tab';
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled?: boolean;
}

interface TabEvent {
  eventType: string;
  spaceId: string;
  reportId: string;
  tabHash?: string;
  tabLabel?: string;
  durationSeconds?: number;
  viewMode: 'embedded' | 'full-tab';
}

export function useAnalyticsBridge({
  spaceId,
  reportId,
  viewMode,
  iframeRef,
  enabled = true,
}: AnalyticsBridgeOptions) {
  const eventsBuffer = useRef<TabEvent[]>([]);
  const currentTab = useRef<{ hash: string; startTime: number } | null>(null);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const flushEvents = useCallback(() => {
    if (eventsBuffer.current.length === 0) return;
    const events = [...eventsBuffer.current];
    eventsBuffer.current = [];
    sendAnalyticsEvent(events);
  }, []);

  const recordTabChange = useCallback(
    (newHash: string, label?: string) => {
      const now = Date.now();

      if (currentTab.current) {
        const duration = Math.round((now - currentTab.current.startTime) / 1000);
        eventsBuffer.current.push({
          eventType: 'tab_view',
          spaceId,
          reportId,
          tabHash: currentTab.current.hash,
          tabLabel: label,
          durationSeconds: duration,
          viewMode,
        });
      }

      currentTab.current = { hash: newHash, startTime: now };
    },
    [spaceId, reportId, viewMode],
  );

  useEffect(() => {
    if (!enabled) return;

    // Record initial report open
    eventsBuffer.current.push({
      eventType: 'report_open',
      spaceId,
      reportId,
      viewMode,
    });

    currentTab.current = { hash: '', startTime: Date.now() };

    // Flush every 30 seconds
    flushIntervalRef.current = setInterval(flushEvents, 30_000);

    // Listen for hashchange via postMessage (cross-origin) or direct access
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'hashchange' && event.data?.hash) {
        recordTabChange(event.data.hash, event.data.label);
      }
    };
    window.addEventListener('message', handleMessage);

    // Try same-origin hashchange listener
    const tryAttachHashListener = () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow;
        if (iframeWindow) {
          iframeWindow.addEventListener('hashchange', () => {
            const hash = iframeWindow.location.hash;
            recordTabChange(hash);
          });
        }
      } catch {
        // Cross-origin, rely on postMessage
      }
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', tryAttachHashListener);
    }

    // Flush on page unload
    const handleBeforeUnload = () => {
      if (currentTab.current) {
        const duration = Math.round((Date.now() - currentTab.current.startTime) / 1000);
        eventsBuffer.current.push({
          eventType: 'tab_view',
          spaceId,
          reportId,
          tabHash: currentTab.current.hash,
          durationSeconds: duration,
          viewMode,
        });
      }
      eventsBuffer.current.push({
        eventType: 'report_close',
        spaceId,
        reportId,
        viewMode,
      });
      flushEvents();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(flushIntervalRef.current);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (iframe) {
        iframe.removeEventListener('load', tryAttachHashListener);
      }
      handleBeforeUnload();
    };
  }, [enabled, spaceId, reportId, viewMode, flushEvents, recordTabChange, iframeRef]);
}
