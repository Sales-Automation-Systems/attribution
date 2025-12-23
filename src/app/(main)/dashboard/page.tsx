import { getDashboardStats, getAllClientConfigs, getRecentLogs, getProcessingJobs } from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { AdminStatsSection } from '@/components/attribution/admin-stats-section';

export default async function DashboardPage() {
  // Fetch data
  const [stats, clients, recentErrors, runningJobs] = await Promise.all([
    getDashboardStats(),
    getAllClientConfigs(),
    getRecentLogs({ level: 'ERROR', limit: 5 }),
    getProcessingJobs({ status: 'RUNNING', limit: 5 }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attribution Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of all client attributions and revenue share
        </p>
      </div>

      {/* Stats Section with Date Filter */}
      <AdminStatsSection
        initialStats={{
          totalAttributedDomains: stats.total_attributed_domains,
          totalPayingCustomers: stats.total_paying_customers,
          totalHardMatches: stats.total_hard_matches,
          totalSoftMatches: stats.total_soft_matches,
          pendingReviews: stats.pending_reviews,
        }}
      />

      {/* Main Content Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Clients List */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clients
            </CardTitle>
            <CardDescription>
              {clients.length} active clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients.slice(0, 8).map((client) => (
                <div key={client.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{client.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(client.rev_share_rate * 100).toFixed(0)}% rev share
                    </p>
                  </div>
                  <Link
                    href={`/client/${client.slug}/${client.access_uuid}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View →
                  </Link>
                </div>
              ))}
              {clients.length > 8 && (
                <Link href="/dashboard/clients" className="block text-sm text-primary hover:underline">
                  View all {clients.length} clients →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity & Errors */}
        <div className="space-y-4">
          {/* Running Jobs */}
          {runningJobs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 animate-spin" />
                  Processing Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {runningJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {job.job_type}
                      </span>
                      <Badge variant="outline">
                        {job.processed_events}/{job.total_events} events
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Disputes */}
          {stats.pending_disputes > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  Pending Disputes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {stats.pending_disputes}
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  Awaiting review
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recent Errors */}
          {recentErrors.length > 0 && (
            <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Recent Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentErrors.slice(0, 3).map((error) => (
                    <div key={error.id} className="text-xs">
                      <p className="font-medium text-red-700 dark:text-red-400 truncate">
                        {error.message}
                      </p>
                      <p className="text-red-600/70 dark:text-red-500/70">
                        {new Date(error.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/admin/logs"
                  className="block mt-2 text-xs text-red-600 hover:underline"
                >
                  View all errors →
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
