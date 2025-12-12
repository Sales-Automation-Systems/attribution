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
import { Target, DollarSign, CheckCircle, Clock, FileText, ExternalLink, Copy } from 'lucide-react';
import Link from 'next/link';

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

  const [stats, recentDomains, periods] = await Promise.all([
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
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {client.slug}
          </Badge>
          <Button variant="ghost" size="icon" title="Copy link">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attributed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_attributed_domains}</div>
            <p className="text-xs text-muted-foreground">Within 31-day window</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paying Customers</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_paying_customers}</div>
            <p className="text-xs text-muted-foreground">Revenue share applicable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hard Matches</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.total_hard_matches}</div>
            <p className="text-xs text-muted-foreground">Exact email match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Soft Matches</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.total_soft_matches}</div>
            <p className="text-xs text-muted-foreground">Domain-level match</p>
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

