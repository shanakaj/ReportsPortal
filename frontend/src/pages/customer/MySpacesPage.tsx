import { SpaceBrowser } from '@/components/customer/SpaceBrowser';

export function MySpacesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Spaces</h1>
        <p className="text-muted-foreground mt-1">
          Access your assigned customer spaces and reports.
        </p>
      </div>

      <SpaceBrowser />
    </div>
  );
}
