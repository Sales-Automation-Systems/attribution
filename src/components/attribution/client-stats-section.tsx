'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { DateRangeFilter, type DateRange } from '@/components/ui/date-range-filter';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';
import { AttributionBreakdown } from '@/components/attribution/attribution-breakdown';
import { format } from 'date-fns';

interface Stats {
  totalEmailsSent: number;
  attributedPositiveReplies: number;
  attributedSignUps: number;
  attributedMeetings: number;
  attributedPaying: number;
  hardMatchPositiveReplies: number;
  hardMatchSignUps: number;
  hardMatchMeetings: number;
  hardMatchPaying: number;
  softMatchPositiveReplies: number;
  softMatchSignUps: number;
  softMatchMeetings: number;
  softMatchPaying: number;
  outsideWindowSignUps: number;
  outsideWindowMeetings: number;
  outsideWindowPaying: number;
  notMatchedSignUps: number;
  notMatchedMeetings: number;
  notMatchedPaying: number;
}

interface ClientStatsSectionProps {
  slug: string;
  uuid: string;
  clientName: string;
  // Initial stats from server (pre-computed, no date filter)
  initialStats: Stats;
}

export function ClientStatsSection({
  slug,
  uuid,
  clientName,
  initialStats,
}: ClientStatsSectionProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client-stats-section.tsx:fetchStats:entry',message:'fetchStats called',data:{startDate:dateRange.startDate?.toISOString(),endDate:dateRange.endDate?.toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
    
    // If no date filter, use initial stats
    if (!dateRange.startDate && !dateRange.endDate) {
      setStats(initialStats);
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) {
        params.set('startDate', format(dateRange.startDate, 'yyyy-MM-dd'));
      }
      if (dateRange.endDate) {
        params.set('endDate', format(dateRange.endDate, 'yyyy-MM-dd'));
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client-stats-section.tsx:fetchStats:beforeFetch',message:'About to fetch stats API',data:{url:`/api/clients/${slug}/${uuid}/stats?${params}`},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      const res = await fetch(`/api/clients/${slug}/${uuid}/stats?${params}`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client-stats-section.tsx:fetchStats:afterFetch',message:'Fetch completed',data:{ok:res.ok,status:res.status,durationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion
      
      if (!res.ok) throw new Error('Failed to fetch stats');
      
      const data = await res.json();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client-stats-section.tsx:fetchStats:gotData',message:'Got stats data',data:{hasStats:!!data.stats,totalDurationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      setStats(data.stats);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/4c8e4cfe-b36f-441c-80e6-a427a219d766',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client-stats-section.tsx:fetchStats:error',message:'Fetch error',data:{error:String(error),durationMs:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error('Error fetching stats:', error);
      // Keep current stats on error
    } finally {
      setLoading(false);
    }
  }, [slug, uuid, dateRange, initialStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Calculate totals for attribution breakdown
  const totalSignUps = stats.attributedSignUps + stats.outsideWindowSignUps + stats.notMatchedSignUps;
  const totalMeetings = stats.attributedMeetings + stats.outsideWindowMeetings + stats.notMatchedMeetings;
  const totalPaying = stats.attributedPaying + stats.outsideWindowPaying + stats.notMatchedPaying;

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

      {/* Section 1: Client's Pipeline */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Client&apos;s Pipeline</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {dateRange.startDate || dateRange.endDate ? (
            <>
              Events from {clientName}&apos;s outreach
              {dateRange.startDate && dateRange.endDate && (
                <span className="font-medium">
                  {' '}({format(dateRange.startDate, 'MMM d, yyyy')} - {format(dateRange.endDate, 'MMM d, yyyy')})
                </span>
              )}
              {dateRange.startDate && !dateRange.endDate && (
                <span className="font-medium"> (from {format(dateRange.startDate, 'MMM d, yyyy')})</span>
              )}
              {!dateRange.startDate && dateRange.endDate && (
                <span className="font-medium"> (until {format(dateRange.endDate, 'MMM d, yyyy')})</span>
              )}
            </>
          ) : (
            <>Total events from {clientName}&apos;s outreach</>
          )}
        </p>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-slate-500" />
                <DefinitionTooltip term="emailsSent" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Emails Sent</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold">
                {stats.totalEmailsSent.toLocaleString('en-US')}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <DefinitionTooltip term="positiveReply" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Positive Replies</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {stats.attributedPositiveReplies.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {stats.attributedPositiveReplies > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / stats.attributedPositiveReplies).toLocaleString('en-US')}:1 email-to-attributed-reply ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="h-4 w-4 text-blue-500" />
                <DefinitionTooltip term="websiteSignUp" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Sign-ups</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {stats.attributedSignUps.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {stats.attributedSignUps > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / stats.attributedSignUps).toLocaleString('en-US')}:1 email-to-attributed-signup ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-amber-500" />
                <DefinitionTooltip term="meetingBooked" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Meetings</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {stats.attributedMeetings.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {stats.attributedMeetings > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / stats.attributedMeetings).toLocaleString('en-US')}:1 email-to-attributed-meeting ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <DefinitionTooltip term="payingCustomer" showUnderline={false}>
                  <span className="text-xs text-muted-foreground">Paying Customers</span>
                </DefinitionTooltip>
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {stats.attributedPaying.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                {stats.attributedPaying > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / stats.attributedPaying).toLocaleString('en-US')}:1 email-to-attributed-customer ratio
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Attribution Breakdown by Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Attribution Breakdown</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Events by attribution status
        </p>
        <AttributionBreakdown
          signUps={{
            total: totalSignUps,
            attributed: stats.attributedSignUps,
            outsideWindow: stats.outsideWindowSignUps,
            unattributed: stats.notMatchedSignUps,
          }}
          meetings={{
            total: totalMeetings,
            attributed: stats.attributedMeetings,
            outsideWindow: stats.outsideWindowMeetings,
            unattributed: stats.notMatchedMeetings,
          }}
          paying={{
            total: totalPaying,
            attributed: stats.attributedPaying,
            outsideWindow: stats.outsideWindowPaying,
            unattributed: stats.notMatchedPaying,
          }}
        />
      </div>
    </>
  );
}

