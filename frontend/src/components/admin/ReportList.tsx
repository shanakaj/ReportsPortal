import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Eye, ExternalLink } from 'lucide-react';
import { listReports, deleteReport } from '@/services/reports';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface ReportListProps {
  spaceId: string;
}

export function ReportList({ spaceId }: ReportListProps) {
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', spaceId],
    queryFn: () => listReports(spaceId),
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteReport(spaceId, deleteTarget.id);
    setDeleteTarget(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const reports = data?.items ?? [];

  if (reports.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No reports uploaded yet. Upload an HTML report to get started.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.reportId}>
              <TableCell className="font-medium">{report.fileName}</TableCell>
              <TableCell className="text-muted-foreground">
                {(report.fileSize / 1024 / 1024).toFixed(2)} MB
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(report.uploadedAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      navigate(`/admin/spaces/${spaceId}/reports/${report.reportId}`)
                    }
                    title="View embedded"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      window.open(`/report/${spaceId}/${report.reportId}`, '_blank')
                    }
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDeleteTarget({ id: report.reportId, name: report.fileName })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Report"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
