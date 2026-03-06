import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SessionExpiredOverlay() {
  const handleGoToPortal = () => {
    window.location.href = '/login';
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-4 max-w-md text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Session Expired</h2>
        <p className="text-muted-foreground mb-6">
          Your viewing session has expired. Please return to the main portal to
          re-authenticate and reopen this report.
        </p>
        <Button onClick={handleGoToPortal} size="lg">
          Go to Portal
        </Button>
      </div>
    </div>
  );
}
