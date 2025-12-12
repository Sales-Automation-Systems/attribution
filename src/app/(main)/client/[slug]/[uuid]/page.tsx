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
  FileText, 
  ExternalLink,
  Mail,
  MessageSquare,
  UserPlus,
  Calendar,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { AttributionBreakdown } from '@/components/attribution/attribution-breakdown';

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

      {/* Section 1: Client's Total Numbers */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Client&apos;s Pipeline</h2>
        <p className="text-sm text-muted-foreground mb-4">Total events from {client.client_name}&apos;s outreach</p>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-muted-foreground">Emails Sent</span>
              </div>
              <div className="text-2xl font-bold">
                {(client.total_emails_sent || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Positive Replies</span>
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {(client.total_positive_replies || 0).toLocaleString()}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {client.attributed_positive_replies || 0} ours (100%)
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Sign-ups</span>
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {(client.total_sign_ups || 0).toLocaleString()}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {client.attributed_sign_ups || 0} ours ({client.total_sign_ups ? Math.round(((client.attributed_sign_ups || 0) / client.total_sign_ups) * 100) : 0}%)
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Meetings</span>
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {(client.total_meetings_booked || 0).toLocaleString()}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {client.attributed_meetings_booked || 0} ours ({client.total_meetings_booked ? Math.round(((client.attributed_meetings_booked || 0) / client.total_meetings_booked) * 100) : 0}%)
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Paying Customers</span>
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {(client.total_paying_customers || 0).toLocaleString()}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                {client.attributed_paying_customers || 0} ours ({client.total_paying_customers ? Math.round(((client.attributed_paying_customers || 0) / client.total_paying_customers) * 100) : 0}%)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Our Attribution Breakdown */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Attribution Breakdown</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Events we&apos;re responsible for, with hard/soft match breakdown
        </p>
        <AttributionBreakdown
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
      </div>

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
