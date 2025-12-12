import { getProcessingJobs, getAllClientConfigs } from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { SyncClientsButton, ProcessAllButton } from './actions';

export default async function ProcessingJobsPage() {
  const [jobs, clients] = await Promise.all([
    getProcessingJobs({ limit: 50 }),
    getAllClientConfigs(),
  ]);

  const clientMap = new Map(clients.map((c) => [c.id, c.client_name]));

  // Group by status
  const running = jobs.filter((j) => j.status === 'RUNNING');
  const pending = jobs.filter((j) => j.status === 'PENDING');
  const completed = jobs.filter((j) => j.status === 'COMPLETED');
  const failed = jobs.filter((j) => j.status === 'FAILED');

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage attribution processing</p>
        </div>
        <div className="flex gap-2">
          <SyncClientsButton />
          <ProcessAllButton />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 animate-spin text-blue-500" />
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{running.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failed.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Running Jobs */}
      {running.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 animate-spin text-blue-500" />
              Currently Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {running.map((job) => (
                <div key={job.id} className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">
                        {job.client_config_id
                          ? clientMap.get(job.client_config_id) || 'Unknown Client'
                          : 'All Clients'}
                      </p>
                      <p className="text-sm text-muted-foreground">{job.job_type}</p>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10">
                      {job.processed_events}/{job.total_events} events
                    </Badge>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${job.total_events > 0 ? (job.processed_events / job.total_events) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>
                      Hard: {job.matched_hard} | Soft: {job.matched_soft} | None: {job.no_match}
                    </span>
                    <span>
                      Started: {job.started_at ? new Date(job.started_at).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Last 50 processing jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 font-medium text-sm">
              <div className="col-span-3">Client</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Progress</div>
              <div className="col-span-3">Time</div>
            </div>
            {jobs.map((job) => (
              <div key={job.id} className="grid grid-cols-12 gap-4 p-3 border-t items-center text-sm">
                <div className="col-span-3 font-medium">
                  {job.client_config_id
                    ? clientMap.get(job.client_config_id) || 'Unknown'
                    : 'All Clients'}
                </div>
                <div className="col-span-2 text-muted-foreground">{job.job_type}</div>
                <div className="col-span-2">
                  <Badge
                    variant={
                      job.status === 'COMPLETED'
                        ? 'default'
                        : job.status === 'FAILED'
                          ? 'destructive'
                          : job.status === 'RUNNING'
                            ? 'secondary'
                            : 'outline'
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
                <div className="col-span-2">
                  {job.processed_events}/{job.total_events}
                </div>
                <div className="col-span-3 text-muted-foreground">
                  {job.completed_at
                    ? new Date(job.completed_at).toLocaleString()
                    : job.started_at
                      ? new Date(job.started_at).toLocaleString()
                      : new Date(job.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

