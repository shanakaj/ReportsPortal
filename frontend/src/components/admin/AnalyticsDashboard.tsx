import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getSpaceAnalytics, exportAnalytics } from '@/services/analytics';
import { listSpaces } from '@/services/spaces';
import { format, subDays } from 'date-fns';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

export function AnalyticsDashboard() {
  const [selectedSpace, setSelectedSpace] = useState('');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);

  const { data: spacesData } = useQuery({
    queryKey: ['spaces-for-analytics'],
    queryFn: () => listSpaces(undefined, 100),
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', selectedSpace, dateFrom, dateTo],
    queryFn: () => getSpaceAnalytics(selectedSpace, dateFrom, dateTo),
    enabled: !!selectedSpace,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportAnalytics({
        spaceId: selectedSpace,
        from: dateFrom,
        to: dateTo,
        format: 'csv',
      });
      window.open(result.downloadUrl, '_blank');
    } catch {
      // Handle error silently
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Space</Label>
              <Select value={selectedSpace} onValueChange={setSelectedSpace}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a space" />
                </SelectTrigger>
                <SelectContent>
                  {spacesData?.items.map((space) => (
                    <SelectItem key={space.spaceId} value={space.spaceId}>
                      {space.spaceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!selectedSpace || isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedSpace && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Select a space to view analytics.
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {analytics && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Views
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalViews}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unique Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.uniqueUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Time per Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(analytics.avgDurationSeconds / 60)} min
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Access by Space */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access by Space</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.accessBySpace}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="spaceName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="accessCount" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tab Breakdown (dynamic) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Time per Tab</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.tabBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.tabBreakdown}
                        dataKey="totalTimeSeconds"
                        nameKey="tabLabel"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ tabLabel, percent }) =>
                          `${tabLabel} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {analytics.tabBreakdown.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `${Math.round(value / 60)} min`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No tab data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Access Frequency */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Access Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.accessFrequency}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
