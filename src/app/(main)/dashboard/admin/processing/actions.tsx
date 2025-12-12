'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SyncClientsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-clients' }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(`✅ Synced! ${data.newClients?.length || 0} new clients added.`);
        router.refresh();
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleSync} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Syncing...' : 'Sync Clients'}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}

export function ProcessAllButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  const handleProcess = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-all-clients' }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(`✅ Started processing ${data.clientCount || 0} clients!`);
        router.refresh();
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleProcess} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Starting...' : 'Process All'}
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}

