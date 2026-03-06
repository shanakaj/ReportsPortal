import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface AnalyticsConsentProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function AnalyticsConsent({ onAccept, onDecline }: AnalyticsConsentProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Analytics & Cookies</h3>
          <p className="text-sm text-muted-foreground mt-1">
            We use analytics to track report engagement and improve the service. This includes
            page views, time spent on reports, and navigation patterns. No personal browsing
            data is collected outside this portal.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setVisible(false);
              onDecline();
            }}
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setVisible(false);
              onAccept();
            }}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
