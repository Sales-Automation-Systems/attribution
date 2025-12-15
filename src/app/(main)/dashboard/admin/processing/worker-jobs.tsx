'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, RefreshCw, StopCircle, Ban, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WorkerJob {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
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

interface JobLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  data?: unknown;
}

export function WorkerJobsDisplay() {
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cancellingJobs, setCancellingJobs] = useState<Set<string>>(new Set());
  const [expandedJobLogs, setExpandedJobLogs] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<Record<string, JobLog[]>>({});
  const [logsLoading, setLogsLoading] = useState(false);

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

  const fetchJobLogs = useCallback(async (jobId: string) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/worker/jobs/${jobId}/logs?limit=200`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setJobLogs((prev) => ({ ...prev, [jobId]: data.logs || [] }));
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const toggleLogs = (jobId: string) => {
    if (expandedJobLogs === jobId) {
      setExpandedJobLogs(null);
    } else {
      setExpandedJobLogs(jobId);
      fetchJobLogs(jobId);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh logs for expanded running job
  useEffect(() => {
    if (!expandedJobLogs) return;
    
    const job = jobs.find(j => j.id === expandedJobLogs);
    if (job?.status !== 'running') return;
    
    const logInterval = setInterval(() => {
      fetchJobLogs(expandedJobLogs);
    }, 2000);
    
    return () => clearInterval(logInterval);
  }, [expandedJobLogs, jobs, fetchJobLogs]);

  const cancelJob = async (jobId: string) => {
    setCancellingJobs((prev) => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/worker/cancel-job/${jobId}`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel job');
      }
      
      toast.success('Cancellation requested', {
        description: 'Job will stop after current client completes.',
      });
      
      // Refresh jobs list
      await fetchJobs();
    } catch (err) {
      toast.error('Failed to cancel job', {
        description: (err as Error).message,
      });
    } finally {
      setCancellingJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const running = jobs.filter((j) => j.status === 'running');
  const completed = jobs.filter((j) => j.status === 'completed');
  const failed = jobs.filter((j) => j.status === 'failed');
  const cancelled = jobs.filter((j) => j.status === 'cancelled');

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
        {cancelled.length > 0 && (
          <Card className="bg-orange-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="h-4 w-4 text-orange-500" />
                Cancelled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{cancelled.length}</div>
            </CardContent>
          </Card>
        )}
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
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-500/10">
                        {job.progress?.current || 0}/{job.progress?.total || 0} clients
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelJob(job.id)}
                        disabled={cancellingJobs.has(job.id)}
                        className="h-7"
                      >
                        {cancellingJobs.has(job.id) ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Stopping...
                          </>
                        ) : (
                          <>
                            <StopCircle className="h-3 w-3 mr-1" />
                            Stop
                          </>
                        )}
                      </Button>
                    </div>
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
                  
                  {/* Logs Toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full justify-between"
                    onClick={() => toggleLogs(job.id)}
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="h-3 w-3" />
                      View Logs
                    </span>
                    {expandedJobLogs === job.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {/* Logs Panel */}
                  {expandedJobLogs === job.id && (
                    <div className="mt-2 bg-gray-900 rounded-lg p-3 max-h-80 overflow-y-auto font-mono text-xs">
                      {logsLoading && jobLogs[job.id]?.length === 0 ? (
                        <div className="text-gray-400 flex items-center gap-2">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Loading logs...
                        </div>
                      ) : jobLogs[job.id]?.length === 0 ? (
                        <div className="text-gray-400">No logs yet...</div>
                      ) : (
                        <div className="space-y-1">
                          {jobLogs[job.id]?.map((log, idx) => (
                            <div key={idx} className="flex gap-2">
                              <span className="text-gray-500 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              <span
                                className={
                                  log.level === 'ERROR'
                                    ? 'text-red-400'
                                    : log.level === 'WARN'
                                      ? 'text-yellow-400'
                                      : log.level === 'DEBUG'
                                        ? 'text-gray-400'
                                        : 'text-green-400'
                                }
                              >
                                [{log.level}]
                              </span>
                              <span className="text-gray-200">{log.message}</span>
                              {log.data && (
                                <span className="text-gray-500">
                                  {JSON.stringify(log.data)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                            : job.status === 'cancelled'
                              ? 'outline'
                              : 'secondary'
                      }
                      className={job.status === 'cancelled' ? 'text-orange-600 border-orange-300' : ''}
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

