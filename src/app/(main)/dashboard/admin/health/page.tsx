import { getWorkerHeartbeat } from '@/db/attribution/queries';
import { prodPool, attrPool } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Server, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';

export default async function HealthPage() {
  // Test database connections
  let prodStatus = { connected: false, latencyMs: 0, error: '' };
  let attrStatus = { connected: false, latencyMs: 0, error: '' };

  try {
    const start = Date.now();
    await prodPool.query('SELECT 1');
    prodStatus = { connected: true, latencyMs: Date.now() - start, error: '' };
  } catch (error) {
    prodStatus = { connected: false, latencyMs: 0, error: (error as Error).message };
  }

  try {
    const start = Date.now();
    await attrPool.query('SELECT 1');
    attrStatus = { connected: true, latencyMs: Date.now() - start, error: '' };
  } catch (error) {
    attrStatus = { connected: false, latencyMs: 0, error: (error as Error).message };
  }

  // Get worker heartbeat
  let workerStatus: {
    status: string;
    lastHeartbeat: Date | null;
    isHealthy: boolean;
  } = {
    status: 'unknown',
    lastHeartbeat: null,
    isHealthy: false,
  };

  try {
    const heartbeat = await getWorkerHeartbeat();
    if (heartbeat) {
      workerStatus = {
        status: heartbeat.status,
        lastHeartbeat: heartbeat.last_heartbeat,
        isHealthy: heartbeat.is_healthy,
      };
    }
  } catch {
    // Worker check failed
  }

  const overallHealthy = prodStatus.connected && attrStatus.connected && workerStatus.isHealthy;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">Monitor system components and connectivity</p>
        </div>
        <Badge
          variant={overallHealthy ? 'default' : 'destructive'}
          className="text-lg px-4 py-2"
        >
          {overallHealthy ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              All Systems Operational
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Issues Detected
            </>
          )}
        </Badge>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Production DB */}
        <Card
          className={
            prodStatus.connected
              ? 'border-green-200 dark:border-green-900'
              : 'border-red-200 dark:border-red-900'
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Production Database
            </CardTitle>
            <CardDescription>DigitalOcean PostgreSQL (Read-Only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge variant={prodStatus.connected ? 'default' : 'destructive'}>
                  {prodStatus.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              {prodStatus.connected && (
                <div className="flex items-center justify-between">
                  <span>Latency</span>
                  <span className="font-mono">{prodStatus.latencyMs}ms</span>
                </div>
              )}
              {prodStatus.error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                  {prodStatus.error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attribution DB */}
        <Card
          className={
            attrStatus.connected
              ? 'border-green-200 dark:border-green-900'
              : 'border-red-200 dark:border-red-900'
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Attribution Database
            </CardTitle>
            <CardDescription>Railway PostgreSQL (Read/Write)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge variant={attrStatus.connected ? 'default' : 'destructive'}>
                  {attrStatus.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              {attrStatus.connected && (
                <div className="flex items-center justify-between">
                  <span>Latency</span>
                  <span className="font-mono">{attrStatus.latencyMs}ms</span>
                </div>
              )}
              {attrStatus.error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                  {attrStatus.error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worker */}
        <Card
          className={
            workerStatus.isHealthy
              ? 'border-green-200 dark:border-green-900'
              : 'border-yellow-200 dark:border-yellow-900'
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Background Worker
            </CardTitle>
            <CardDescription>Railway pg-boss Worker</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge
                  variant={
                    workerStatus.isHealthy
                      ? 'default'
                      : workerStatus.status === 'unknown'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {workerStatus.status}
                </Badge>
              </div>
              {workerStatus.lastHeartbeat && (
                <div className="flex items-center justify-between">
                  <span>Last Heartbeat</span>
                  <span className="text-sm">
                    {new Date(workerStatus.lastHeartbeat).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {!workerStatus.isHealthy && workerStatus.status !== 'unknown' && (
                <div className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                  Heartbeat is stale. Worker may need restart.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Environment</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Node Environment</span>
                  <span className="font-mono">{process.env.NODE_ENV}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timezone</span>
                  <span className="font-mono">{process.env.TZ || 'UTC'}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">API Endpoints</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health Check</span>
                  <code className="text-xs bg-muted px-1 rounded">/api/health</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job Trigger</span>
                  <code className="text-xs bg-muted px-1 rounded">/api/jobs/trigger</code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



