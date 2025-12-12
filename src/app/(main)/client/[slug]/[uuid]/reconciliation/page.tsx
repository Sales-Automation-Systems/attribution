import { notFound } from 'next/navigation';
import { getClientConfigBySlugAndUuid, getReconciliationPeriods } from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, ArrowLeft, ExternalLink, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default async function ReconciliationHistoryPage({
  params,
}: {
  params: Promise<{ slug: string; uuid: string }>;
}) {
  const { slug, uuid } = await params;

  const client = await getClientConfigBySlugAndUuid(slug, uuid);
  if (!client) {
    notFound();
  }

  const periods = await getReconciliationPeriods(client.id);

  // Calculate totals
  const totalRevenue = periods.reduce((sum, p) => sum + Number(p.total_revenue || 0), 0);
  const totalRevShare = periods.reduce((sum, p) => sum + Number(p.rev_share_amount || 0), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/client/${slug}/${uuid}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation History</h1>
          <p className="text-muted-foreground">{client.client_name}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periods.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rev Share</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalRevShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Periods List */}
      <div className="space-y-4">
        {periods.length > 0 ? (
          periods.map((period) => {
            const monthName =
              period.month === 0
                ? 'Historical (Pre-December 2025)'
                : new Date(period.year, period.month - 1).toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                  });

            const deadlineDate = period.deadline ? new Date(period.deadline) : null;
            const isOverdue = deadlineDate && deadlineDate < new Date() && period.status === 'OPEN';

            return (
              <Link
                key={period.id}
                href={`/client/${slug}/${uuid}/reconciliation/${period.year}/${period.month}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{monthName}</CardTitle>
                          <CardDescription>
                            {period.net_new_attributed} attributed, {period.net_new_paying} paying
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            ${Number(period.total_revenue || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${Number(period.rev_share_amount || 0).toLocaleString()} share
                          </p>
                        </div>
                        <Badge
                          variant={
                            period.status === 'LOCKED'
                              ? 'default'
                              : period.status === 'SUBMITTED'
                                ? 'secondary'
                                : isOverdue
                                  ? 'destructive'
                                  : 'outline'
                          }
                        >
                          {isOverdue ? 'OVERDUE' : period.status}
                        </Badge>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  {deadlineDate && period.status === 'OPEN' && (
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Deadline: {deadlineDate.toLocaleDateString()}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            );
          })
        ) : (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Reconciliation Periods</h3>
            <p className="text-muted-foreground">
              Reconciliation periods will be created automatically on the 1st of each month.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}




