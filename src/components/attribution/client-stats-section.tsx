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
  Users,
  BarChart3,
} from 'lucide-react';
import { DateRangeFilter, type DateRange } from '@/components/ui/date-range-filter';
import { DefinitionTooltip } from '@/components/ui/definition-tooltip';
import { AttributionBreakdown } from '@/components/attribution/attribution-breakdown';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface AccountStats {
  totalAccountsWithReplies: number;
  totalAccountsWithSignUps: number;
  totalAccountsWithMeetings: number;
  totalAccountsWithPaying: number;
  attributedAccountsWithReplies: number;
  attributedAccountsWithSignUps: number;
  attributedAccountsWithMeetings: number;
  attributedAccountsWithPaying: number;
  outsideWindowAccountsWithSignUps: number;
  outsideWindowAccountsWithMeetings: number;
  outsideWindowAccountsWithPaying: number;
  unattributedAccountsWithSignUps: number;
  unattributedAccountsWithMeetings: number;
  unattributedAccountsWithPaying: number;
}

type ViewMode = 'events' | 'accounts';

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
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) {
        params.set('startDate', format(dateRange.startDate, 'yyyy-MM-dd'));
      }
      if (dateRange.endDate) {
        params.set('endDate', format(dateRange.endDate, 'yyyy-MM-dd'));
      }

      const res = await fetch(`/api/clients/${slug}/${uuid}/stats?${params}`);
      
      if (!res.ok) throw new Error('Failed to fetch stats');
      
      const data = await res.json();
      
      setStats(data.stats);
      setAccountStats(data.accountStats || null);
      setInitialLoadDone(true);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Keep current stats on error
    } finally {
      setLoading(false);
    }
  }, [slug, uuid, dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Calculate totals for attribution breakdown - EVENT level
  const totalSignUps = stats.attributedSignUps + stats.outsideWindowSignUps + stats.notMatchedSignUps;
  const totalMeetings = stats.attributedMeetings + stats.outsideWindowMeetings + stats.notMatchedMeetings;
  const totalPaying = stats.attributedPaying + stats.outsideWindowPaying + stats.notMatchedPaying;

  // Calculate totals for attribution breakdown - ACCOUNT level
  const totalAccountSignUps = accountStats 
    ? accountStats.attributedAccountsWithSignUps + accountStats.outsideWindowAccountsWithSignUps + accountStats.unattributedAccountsWithSignUps
    : 0;
  const totalAccountMeetings = accountStats 
    ? accountStats.attributedAccountsWithMeetings + accountStats.outsideWindowAccountsWithMeetings + accountStats.unattributedAccountsWithMeetings
    : 0;
  const totalAccountPaying = accountStats 
    ? accountStats.attributedAccountsWithPaying + accountStats.outsideWindowAccountsWithPaying + accountStats.unattributedAccountsWithPaying
    : 0;

  // Calculate displayed values based on viewMode
  const displayedReplies = viewMode === 'events' 
    ? stats.attributedPositiveReplies 
    : (accountStats?.attributedAccountsWithReplies ?? stats.attributedPositiveReplies);
  const displayedSignUps = viewMode === 'events' 
    ? stats.attributedSignUps 
    : (accountStats?.attributedAccountsWithSignUps ?? stats.attributedSignUps);
  const displayedMeetings = viewMode === 'events' 
    ? stats.attributedMeetings 
    : (accountStats?.attributedAccountsWithMeetings ?? stats.attributedMeetings);
  const displayedPaying = viewMode === 'events' 
    ? stats.attributedPaying 
    : (accountStats?.attributedAccountsWithPaying ?? stats.attributedPaying);

  const pipelineLabel = viewMode === 'events' ? 'events' : 'accounts';

  return (
    <>
      {/* Filter Row: Date Filter + View Mode Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          )}
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setViewMode('events')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'events'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Events
            </button>
            <button
              onClick={() => setViewMode('accounts')}
              disabled={!accountStats && initialLoadDone}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'accounts'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                !accountStats && initialLoadDone && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Users className="h-4 w-4" />
              Accounts
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Client's Pipeline */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Client&apos;s Pipeline</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {dateRange.startDate || dateRange.endDate ? (
            <>
              Attributed {pipelineLabel} from {clientName}&apos;s outreach
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
            <>Total attributed {pipelineLabel} from {clientName}&apos;s outreach</>
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
                {displayedReplies.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {displayedReplies > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / displayedReplies).toLocaleString('en-US')}:1 email-to-{pipelineLabel === 'events' ? 'reply' : 'account'} ratio
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
                {displayedSignUps.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {displayedSignUps > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / displayedSignUps).toLocaleString('en-US')}:1 email-to-{pipelineLabel === 'events' ? 'signup' : 'account'} ratio
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
                {displayedMeetings.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {displayedMeetings > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / displayedMeetings).toLocaleString('en-US')}:1 email-to-{pipelineLabel === 'events' ? 'meeting' : 'account'} ratio
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
                {displayedPaying.toLocaleString('en-US')}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                {displayedPaying > 0 && stats.totalEmailsSent > 0 ? (
                  <span>
                    {Math.round(stats.totalEmailsSent / displayedPaying).toLocaleString('en-US')}:1 email-to-{pipelineLabel === 'events' ? 'customer' : 'account'} ratio
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
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Attribution Breakdown</h2>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'events' ? 'Events' : 'Accounts'} by attribution status
          </p>
        </div>
        
        {viewMode === 'events' ? (
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
            labelSuffix="total from client"
          />
        ) : accountStats ? (
          <AttributionBreakdown
            signUps={{
              total: totalAccountSignUps,
              attributed: accountStats.attributedAccountsWithSignUps,
              outsideWindow: accountStats.outsideWindowAccountsWithSignUps,
              unattributed: accountStats.unattributedAccountsWithSignUps,
            }}
            meetings={{
              total: totalAccountMeetings,
              attributed: accountStats.attributedAccountsWithMeetings,
              outsideWindow: accountStats.outsideWindowAccountsWithMeetings,
              unattributed: accountStats.unattributedAccountsWithMeetings,
            }}
            paying={{
              total: totalAccountPaying,
              attributed: accountStats.attributedAccountsWithPaying,
              outsideWindow: accountStats.outsideWindowAccountsWithPaying,
              unattributed: accountStats.unattributedAccountsWithPaying,
            }}
            labelSuffix="accounts"
          />
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading account stats...
          </div>
        )}
      </div>
    </>
  );
}

