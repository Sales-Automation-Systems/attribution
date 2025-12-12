import { notFound } from 'next/navigation';
import {
  getClientConfigBySlugAndUuid,
  getReconciliationPeriod,
  getAttributedDomains,
} from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, Send, Clock, CheckCircle, Lock, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default async function ReconciliationPeriodPage({
  params,
}: {
  params: Promise<{ slug: string; uuid: string; year: string; month: string }>;
}) {
  const { slug, uuid, year, month } = await params;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  const period = await getReconciliationPeriod(client.id, parseInt(year), parseInt(month));
  if (!period) {
    notFound();
  }

  // Get paying customers for this period
  const payingDomains = await getAttributedDomains(client.id, {
    limit: 200,
  });
  const payingCustomers = payingDomains.filter((d) => d.has_paying_customer);

  const monthName =
    period.month === 0
      ? 'Historical (Pre-December 2025)'
      : new Date(period.year, period.month - 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });

  const statusIcon =
    period.status === 'LOCKED' ? (
      <Lock className="h-4 w-4" />
    ) : period.status === 'SUBMITTED' ? (
      <CheckCircle className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    );

  const deadlineDate = period.deadline ? new Date(period.deadline) : null;
  const isEditable = period.status === 'OPEN';

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/client/${slug}/${uuid}/reconciliation`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{monthName}</h1>
            <Badge
              variant={
                period.status === 'LOCKED'
                  ? 'default'
                  : period.status === 'SUBMITTED'
                    ? 'secondary'
                    : 'outline'
              }
              className="flex items-center gap-1"
            >
              {statusIcon}
              {period.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {client.client_name} • {(client.rev_share_rate * 100).toFixed(0)}% revenue share
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {isEditable && (
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Submit
            </Button>
          )}
        </div>
      </div>

      {/* Deadline Banner */}
      {deadlineDate && period.status === 'OPEN' && (
        <Card
          className={
            deadlineDate < new Date()
              ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
              : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          }
        >
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {deadlineDate < new Date() ? 'Deadline Passed' : 'Deadline'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deadlineDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Button size="sm">Submit Now</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net New Attributed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{period.net_new_attributed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net New Paying</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{period.net_new_paying}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(period.total_revenue || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue Share Owed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${Number(period.rev_share_amount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {((period.rev_share_rate || client.rev_share_rate) * 100).toFixed(0)}% rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Paying Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Paying Customers</CardTitle>
          <CardDescription>
            Enter revenue for each paying customer attributed to this period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payingCustomers.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 font-medium text-sm">
                  <div className="col-span-4">Domain</div>
                  <div className="col-span-2">Event Date</div>
                  <div className="col-span-2">Match Type</div>
                  <div className="col-span-2">Revenue</div>
                  <div className="col-span-2">Notes</div>
                </div>
                {payingCustomers.map((domain) => (
                  <div
                    key={domain.id}
                    className="grid grid-cols-12 gap-4 p-3 border-t items-center"
                  >
                    <div className="col-span-4">
                      <p className="font-medium">{domain.domain}</p>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {domain.first_event_at
                        ? new Date(domain.first_event_at).toLocaleDateString()
                        : 'N/A'}
                    </div>
                    <div className="col-span-2">
                      <Badge
                        variant={domain.match_type === 'HARD_MATCH' ? 'default' : 'secondary'}
                      >
                        {domain.match_type === 'HARD_MATCH' ? 'Hard' : 'Soft'}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="pl-7"
                          disabled={!isEditable}
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Input placeholder="Notes..." disabled={!isEditable} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No paying customers in this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              1. Enter the revenue collected from each paying customer during this period.
            </p>
            <p>
              2. Revenue should be the actual cash collected, not contracted value.
            </p>
            <p>
              3. Once complete, click Submit to finalize this reconciliation period.
            </p>
            <p>
              4. After submission, the period will be reviewed and locked for invoicing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}




