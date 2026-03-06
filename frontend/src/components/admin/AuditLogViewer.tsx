import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryAuditLog } from '@/services/audit';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, subDays } from 'date-fns';

const ACTION_TYPES = [
  'login',
  'logout',
  'invite_customer',
  'invite_admin',
  'upload_report',
  'delete_report',
  'create_space',
  'delete_space',
  'disable_user',
  'enable_user',
  'delete_user',
  'reset_mfa',
  'impersonate_start',
  'impersonate_end',
  'report_access',
  'feedback_created',
  'feedback_reply',
  'feedback_status_change',
];

export function AuditLogViewer() {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', actor, action, spaceId, dateFrom, dateTo, cursor],
    queryFn: () =>
      queryAuditLog({
        actor: actor || undefined,
        action: action || undefined,
        spaceId: spaceId || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        cursor,
      }),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">User</Label>
          <Input
            placeholder="Filter by user..."
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setCursor(undefined);
            }}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <Select
            value={action}
            onValueChange={(val) => {
              setAction(val);
              setCursor(undefined);
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All actions</SelectItem>
              {ACTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Space</Label>
          <Input
            placeholder="Space ID..."
            value={spaceId}
            onChange={(e) => {
              setSpaceId(e.target.value);
              setCursor(undefined);
            }}
            className="h-9 w-[150px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCursor(undefined);
            }}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCursor(undefined);
            }}
            className="h-9"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((entry) => (
                <TableRow key={entry.eventId}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell className="text-sm">{entry.actorEmail}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {entry.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {entry.target}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.result === 'success' ? 'success' : 'destructive'}>
                      {entry.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.ipAddress}
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.items || data.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No audit log entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data?.hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setCursor(data.nextCursor)}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
