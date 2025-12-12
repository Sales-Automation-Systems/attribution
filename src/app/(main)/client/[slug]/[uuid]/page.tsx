import { notFound } from 'next/navigation';
import {
  getClientConfigBySlugAndUuid,
  getDashboardStats,
  getAttributedDomains,
  getReconciliationPeriods,
  getClientStats,
} from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  MessageSquare, 
  UserPlus, 
  Calendar, 
  DollarSign, 
  Target, 
  CheckCircle, 
  Clock, 
  FileText, 
  ExternalLink 
} from 'lucide-react';
import Link from 'next/link';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function getPercentage(attributed: number, total: number): string {
  if (total === 0) return '0%';
  return Math.round((attributed / total) * 100) + '%';
}

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

  const [domainStats, clientStats, recentDomains, periods] = await Promise.all([
    getDashboardStats(client.id),
    getClientStats(client.id),
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
            {clientStats.last_processed_at && (
              <span className="ml-2 text-xs">
                · Last updated: {new Date(clientStats.last_processed_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {client.slug}
        </Badge>
      </div>

      {/* Top-Level Pipeline Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* Emails Sent */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatNumber(clientStats.total_emails_sent)}
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Total outreach</p>
          </CardContent>
        </Card>

        {/* Positive Replies */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Positive Replies</CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {formatNumber(clientStats.total_positive_replies)}
            </div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
              100% attributed
            </p>
          </CardContent>
        </Card>

        {/* Sign-ups */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sign-ups</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(clientStats.total_sign_ups)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">{clientStats.attributed_sign_ups}</span> attributed ({getPercentage(clientStats.attributed_sign_ups, clientStats.total_sign_ups)})
            </p>
          </CardContent>
        </Card>

        {/* Meetings Booked */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(clientStats.total_meetings_booked)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 font-medium">{clientStats.attributed_meetings_booked}</span> attributed ({getPercentage(clientStats.attributed_meetings_booked, clientStats.total_meetings_booked)})
            </p>
          </CardContent>
        </Card>

        {/* Paying Customers */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Paying Customers</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {formatNumber(clientStats.total_paying_customers)}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
              <span className="font-medium">{clientStats.attributed_paying_customers}</span> attributed ({getPercentage(clientStats.attributed_paying_customers, clientStats.total_paying_customers)})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Match Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attributed Domains</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domainStats.total_attributed_domains}</div>
            <p className="text-xs text-muted-foreground">Within 31-day window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hard Matches</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{domainStats.total_hard_matches}</div>
            <p className="text-xs text-muted-foreground">Exact email match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Soft Matches</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{domainStats.total_soft_matches}</div>
            <p className="text-xs text-muted-foreground">Domain-level match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paying Domains</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domainStats.total_paying_customers}</div>
            <p className="text-xs text-muted-foreground">Revenue share applicable</p>
          </CardContent>
        </Card>
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
