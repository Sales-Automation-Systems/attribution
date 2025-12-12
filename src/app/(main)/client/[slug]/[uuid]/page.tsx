import { notFound } from 'next/navigation';
import {
  getClientConfigBySlugAndUuid,
  getDashboardStats,
  getAttributedDomains,
  getReconciliationPeriods,
} from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, 
  CheckCircle, 
  Clock, 
  FileText, 
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { PipelineFunnel } from '@/components/attribution/pipeline-funnel';
import { AttributionTable } from '@/components/attribution/attribution-table';
import { DomainBreakdown } from '@/components/attribution/domain-breakdown';

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ slug: string; uuid: string }>;
}) {
  const { slug, uuid } = await params;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  const [domainStats, recentDomains, periods] = await Promise.all([
    getDashboardStats(client.id),
    getAttributedDomains(client.id, { limit: 10 }),
    getReconciliationPeriods(client.id),
  ]);

  // Find current period (this month)
  const now = new Date();
  const currentPeriod = periods.find(
    (p) => p.year === now.getFullYear() && p.month === now.getMonth() + 1
  );

  // Calculate total hard and soft matches from the detailed breakdown
  const totalHardMatches = (client.hard_match_positive_replies || 0) + 
    (client.hard_match_sign_ups || 0) + 
    (client.hard_match_meetings || 0) + 
    (client.hard_match_paying || 0);
  
  const totalSoftMatches = (client.soft_match_positive_replies || 0) + 
    (client.soft_match_sign_ups || 0) + 
    (client.soft_match_meetings || 0) + 
    (client.soft_match_paying || 0);

  const totalAttributed = (client.attributed_positive_replies || 0) +
    (client.attributed_sign_ups || 0) +
    (client.attributed_meetings_booked || 0) +
    (client.attributed_paying_customers || 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.client_name}</h1>
          <p className="text-muted-foreground">
            {(client.rev_share_rate * 100).toFixed(0)}% revenue share
            {client.last_processed_at && (
              <span className="ml-2 text-xs">
                · Last updated: {new Date(client.last_processed_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {client.slug}
        </Badge>
      </div>

      {/* Section 1: Pipeline Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pipeline Overview</CardTitle>
          <CardDescription>Customer journey from outreach to conversion</CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineFunnel
            emailsSent={client.total_emails_sent || 0}
            positiveReplies={client.total_positive_replies || 0}
            attributedReplies={client.attributed_positive_replies || 0}
            signUps={client.total_sign_ups || 0}
            attributedSignUps={client.attributed_sign_ups || 0}
            meetings={client.total_meetings_booked || 0}
            attributedMeetings={client.attributed_meetings_booked || 0}
            paying={client.total_paying_customers || 0}
            attributedPaying={client.attributed_paying_customers || 0}
          />
        </CardContent>
      </Card>

      {/* Section 2: Attribution Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attributed Domains</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domainStats.total_attributed_domains}</div>
            <p className="text-xs text-muted-foreground">Unique domains consolidated</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hard Matches</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalHardMatches}</div>
            <p className="text-xs text-muted-foreground">
              {totalAttributed > 0 ? Math.round((totalHardMatches / totalAttributed) * 100) : 0}% of attributed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-200 dark:border-yellow-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Soft Matches</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{totalSoftMatches}</div>
            <p className="text-xs text-muted-foreground">
              {totalAttributed > 0 ? Math.round((totalSoftMatches / totalAttributed) * 100) : 0}% of attributed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Disputes</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domainStats.pending_disputes}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Detailed Attribution Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attribution Breakdown by Event Type</CardTitle>
          <CardDescription>
            Detailed view of hard match, soft match, and unmatched events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttributionTable
            positiveReplies={{
              total: client.total_positive_replies || 0,
              attributed: client.attributed_positive_replies || 0,
              hardMatch: client.hard_match_positive_replies || 0,
              softMatch: client.soft_match_positive_replies || 0,
            }}
            signUps={{
              total: client.total_sign_ups || 0,
              attributed: client.attributed_sign_ups || 0,
              hardMatch: client.hard_match_sign_ups || 0,
              softMatch: client.soft_match_sign_ups || 0,
              outsideWindow: client.outside_window_sign_ups || 0,
              notMatched: client.not_matched_sign_ups || 0,
            }}
            meetings={{
              total: client.total_meetings_booked || 0,
              attributed: client.attributed_meetings_booked || 0,
              hardMatch: client.hard_match_meetings || 0,
              softMatch: client.soft_match_meetings || 0,
              outsideWindow: client.outside_window_meetings || 0,
              notMatched: client.not_matched_meetings || 0,
            }}
            paying={{
              total: client.total_paying_customers || 0,
              attributed: client.attributed_paying_customers || 0,
              hardMatch: client.hard_match_paying || 0,
              softMatch: client.soft_match_paying || 0,
              outsideWindow: client.outside_window_paying || 0,
              notMatched: client.not_matched_paying || 0,
            }}
          />
        </CardContent>
      </Card>

      {/* Section 4: Domain Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Breakdown</CardTitle>
          <CardDescription>How many domains have each type of event</CardDescription>
        </CardHeader>
        <CardContent>
          <DomainBreakdown
            domainsWithReplies={client.domains_with_replies || 0}
            domainsWithSignups={client.domains_with_signups || 0}
            domainsWithMeetings={client.domains_with_meetings || 0}
            domainsWithPaying={client.domains_with_paying || 0}
            domainsWithMultiple={client.domains_with_multiple_events || 0}
            totalDomains={domainStats.total_attributed_domains}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href={`/client/${slug}/${uuid}/leads`}>
          <Button>
            <Target className="h-4 w-4 mr-2" />
            View All Leads
          </Button>
        </Link>
        {currentPeriod && (
          <Link href={`/client/${slug}/${uuid}/reconciliation/${currentPeriod.year}/${currentPeriod.month}`}>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Current Reconciliation
            </Button>
          </Link>
        )}
        <Link href={`/client/${slug}/${uuid}/reconciliation`}>
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Reconciliation History
          </Button>
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Attributed Domains */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attributed Leads</CardTitle>
            <CardDescription>Latest domains with attribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDomains.length > 0 ? (
                recentDomains.map((domain) => (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{domain.domain}</p>
                      <div className="flex gap-1 mt-1">
                        {domain.has_positive_reply && (
                          <Badge variant="outline" className="text-xs">Reply</Badge>
                        )}
                        {domain.has_sign_up && (
                          <Badge variant="outline" className="text-xs">Sign-up</Badge>
                        )}
                        {domain.has_meeting_booked && (
                          <Badge variant="outline" className="text-xs">Meeting</Badge>
                        )}
                        {domain.has_paying_customer && (
                          <Badge className="text-xs bg-green-500">Paying</Badge>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={domain.match_type === 'HARD_MATCH' ? 'default' : 'secondary'}
                    >
                      {domain.match_type === 'HARD_MATCH' ? 'Hard' : 'Soft'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No attributed leads yet
                </p>
              )}
            </div>
            {recentDomains.length > 0 && (
              <Link
                href={`/client/${slug}/${uuid}/leads`}
                className="block mt-4 text-sm text-primary hover:underline"
              >
                View all leads →
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Reconciliation Periods */}
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Periods</CardTitle>
            <CardDescription>Monthly revenue share tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {periods.length > 0 ? (
                periods.slice(0, 6).map((period) => {
                  const monthName =
                    period.month === 0
                      ? 'Historical'
                      : new Date(period.year, period.month - 1).toLocaleString('default', {
                          month: 'long',
                          year: 'numeric',
                        });

                  return (
                    <Link
                      key={period.id}
                      href={`/client/${slug}/${uuid}/reconciliation/${period.year}/${period.month}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{monthName}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.net_new_attributed} attributed, {period.net_new_paying} paying
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            period.status === 'LOCKED'
                              ? 'default'
                              : period.status === 'SUBMITTED'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {period.status}
                        </Badge>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No reconciliation periods yet
                </p>
              )}
            </div>
            {periods.length > 6 && (
              <Link
                href={`/client/${slug}/${uuid}/reconciliation`}
                className="block mt-4 text-sm text-primary hover:underline"
              >
                View all periods →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
