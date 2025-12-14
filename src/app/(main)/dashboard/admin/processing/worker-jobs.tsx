'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkerJob {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  progress?: {
    current: number;
    total: number;
    currentClient?: string;
  };
  result?: unknown;
  error?: string;
}

export function WorkerJobsDisplay() {
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/worker/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const running = jobs.filter((j) => j.status === 'running');
  const completed = jobs.filter((j) => j.status === 'completed');
  const failed = jobs.filter((j) => j.status === 'failed');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading worker jobs...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-red-600">Error loading worker jobs: {error}</p>
          <Button variant="outline" size="sm" onClick={fetchJobs} className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className={`h-4 w-4 text-blue-500 ${running.length > 0 ? 'animate-spin' : ''}`} />
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
            <div className="text-2xl font-bold">0</div>
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
                      <p className="font-medium">{job.type === 'process-all' ? 'All Clients' : job.type}</p>
                      {job.progress?.currentClient && (
                        <p className="text-sm text-muted-foreground">
                          Currently: {job.progress.currentClient}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10">
                      {job.progress?.current || 0}/{job.progress?.total || 0} clients
                    </Badge>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${job.progress?.total ? (job.progress.current / job.progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Job ID: {job.id}</span>
                    <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Worker Jobs</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No jobs found. Click "Process All" to start processing.
            </p>
          ) : (
            <div className="rounded-lg border">
              <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 font-medium text-sm">
                <div className="col-span-4">Job ID</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Progress</div>
                <div className="col-span-2">Time</div>
              </div>
              {jobs.map((job) => (
                <div key={job.id} className="grid grid-cols-12 gap-4 p-3 border-t items-center text-sm">
                  <div className="col-span-4 font-mono text-xs truncate">{job.id}</div>
                  <div className="col-span-2 text-muted-foreground">{job.type}</div>
                  <div className="col-span-2">
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'default'
                          : job.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    {job.progress
                      ? `${job.progress.current}/${job.progress.total}`
                      : '-'}
                  </div>
                  <div className="col-span-2 text-muted-foreground text-xs">
                    {job.completedAt
                      ? new Date(job.completedAt).toLocaleTimeString()
                      : new Date(job.startedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

