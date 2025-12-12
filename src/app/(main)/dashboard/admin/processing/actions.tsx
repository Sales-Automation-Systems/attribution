'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play, Loader2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface ClientOption {
  client_id: string;
  client_name: string;
}

export function ProcessSingleClientButton() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients/list');
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  const handleProcess = async () => {
    if (!selectedClientId) return;
    
    const selectedClient = clients.find(c => c.client_id === selectedClientId);
    
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/jobs/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'process-client',
          clientId: selectedClientId,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(`✅ Started processing ${selectedClient?.client_name || 'client'}!`);
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          value={selectedClientId}
          onValueChange={setSelectedClientId}
          disabled={loadingClients || loading}
        >
          <SelectTrigger className="w-[220px]">
            <User className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder={loadingClients ? "Loading..." : "Select a client..."} />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.client_id} value={client.client_id}>
                {client.client_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          variant="secondary"
          onClick={handleProcess} 
          disabled={loading || !selectedClientId}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Processing...' : 'Process Client'}
        </Button>
      </div>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
