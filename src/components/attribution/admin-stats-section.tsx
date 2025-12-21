'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, DollarSign, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { DateRangeFilter, type DateRange } from '@/components/ui/date-range-filter';
import { format } from 'date-fns';

interface Stats {
  totalAttributedDomains: number;
  totalPayingCustomers: number;
  totalHardMatches: number;
  totalSoftMatches: number;
  pendingDisputes: number;
}

interface AdminStatsSectionProps {
  initialStats: Stats;
}

export function AdminStatsSection({ initialStats }: AdminStatsSectionProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    // If no date filter, use initial stats
    if (!dateRange.startDate && !dateRange.endDate) {
      setStats(initialStats);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) {
        params.set('startDate', format(dateRange.startDate, 'yyyy-MM-dd'));
      }
      if (dateRange.endDate) {
        params.set('endDate', format(dateRange.endDate, 'yyyy-MM-dd'));
      }

      const res = await fetch(`/api/admin/stats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      
      const data = await res.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, initialStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <>
      {/* Date Filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attributed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttributedDomains.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Domains with successful attribution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paying Customers</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPayingCustomers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Attributed leads that became paying
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Direct Matches</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHardMatches.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Exact email matches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Company Matches</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSoftMatches.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Domain-level matches
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


