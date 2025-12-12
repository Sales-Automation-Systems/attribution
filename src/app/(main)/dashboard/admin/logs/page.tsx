import { getRecentLogs, getAllClientConfigs } from '@/db/attribution/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Info, AlertCircle, Bug } from 'lucide-react';

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const search = await searchParams;
  const level = (search.level as string) || undefined;
  const source = (search.source as string) || undefined;

  const logs = await getRecentLogs({
    level: level as 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | undefined,
    source: source as 'worker' | 'api' | 'cron' | 'ui' | undefined,
    limit: 100,
  });

  const clients = await getAllClientConfigs();
  const clientMap = new Map(clients.map((c) => [c.id, c.client_name]));

  // Count by level
  const errorCount = logs.filter((l) => l.level === 'ERROR').length;
  const warnCount = logs.filter((l) => l.level === 'WARN').length;
  const infoCount = logs.filter((l) => l.level === 'INFO').length;

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'INFO':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'DEBUG':
        return <Bug className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
      case 'WARN':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900';
      case 'INFO':
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900';
      default:
        return 'bg-gray-50 dark:bg-gray-950/20';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground">View system logs and errors</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Errors</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Warnings</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{warnCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Info</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{infoCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium">Total Logs</div>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select defaultValue={level || 'all'}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Log Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="WARN">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="DEBUG">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue={source || 'all'}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="worker">Worker</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="cron">Cron</SelectItem>
            <SelectItem value="ui">UI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {logs.length > 0 ? (
          logs.map((log) => (
            <Card key={log.id} className={`border ${getLevelColor(log.level)}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      {log.client_config_id && clientMap.get(log.client_config_id) && (
                        <Badge variant="secondary" className="text-xs">
                          {clientMap.get(log.client_config_id)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">{log.message}</p>
                    {log.context && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center">
            <Info className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Logs Found</h3>
            <p className="text-muted-foreground">
              No logs match your current filters.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

