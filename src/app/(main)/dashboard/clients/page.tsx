import { getAllClientConfigs, getDashboardStats } from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Target, DollarSign, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function ClientsPage() {
  const clients = await getAllClientConfigs();

  // Get stats for each client
  const clientsWithStats = await Promise.all(
    clients.map(async (client) => {
      const stats = await getDashboardStats(client.id);
      return { client, stats };
    })
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage client attributions and revenue share
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Users className="h-4 w-4 mr-2" />
          {clients.length} Clients
        </Badge>
      </div>

      {/* Client Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clientsWithStats.map(({ client, stats }) => (
          <Card key={client.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{client.client_name}</CardTitle>
                  <CardDescription>
                    {(client.rev_share_rate * 100).toFixed(0)}% revenue share
                  </CardDescription>
                </div>
                <Badge variant="outline">{client.slug}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Target className="h-3 w-3" />
                    Attributed
                  </div>
                  <p className="text-xl font-bold">{stats.total_attributed_domains}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    Paying
                  </div>
                  <p className="text-xl font-bold">{stats.total_paying_customers}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Direct Match
                  </div>
                  <p className="text-lg font-semibold text-green-600">{stats.total_hard_matches}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 text-yellow-500" />
                    Company Match
                  </div>
                  <p className="text-lg font-semibold text-yellow-600">{stats.total_soft_matches}</p>
                </div>
              </div>

              {/* Disputes Badge */}
              {stats.pending_disputes > 0 && (
                <Badge variant="destructive" className="w-full justify-center">
                  {stats.pending_disputes} pending dispute{stats.pending_disputes > 1 ? 's' : ''}
                </Badge>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/client/${client.slug}/${client.access_uuid}`}
                  className="flex-1"
                >
                  <Button variant="default" className="w-full" size="sm">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Dashboard
                  </Button>
                </Link>
              </div>

              {/* Client Link */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono truncate">
                /client/{client.slug}/{client.access_uuid}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {clients.length === 0 && (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Clients Yet</h3>
          <p className="text-muted-foreground mb-4">
            Clients will be automatically synced from the production database.
          </p>
          <Button variant="outline">
            Trigger Client Sync
          </Button>
        </Card>
      )}
    </div>
  );
}

