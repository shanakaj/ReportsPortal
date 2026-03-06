import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

export function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          View all admin and user actions across the portal.
        </p>
      </div>

      <AuditLogViewer />
    </div>
  );
}
