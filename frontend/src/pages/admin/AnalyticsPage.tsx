import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

export function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          View report engagement and user activity analytics.
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}
