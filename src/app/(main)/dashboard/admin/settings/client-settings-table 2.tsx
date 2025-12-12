'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClientSettings {
  id: string;
  client_id: string;
  client_name: string;
  slug: string;
  rev_share_rate: number;
  sign_ups_mode: 'per_event' | 'per_domain';
  meetings_mode: 'per_event' | 'per_domain';
  paying_mode: 'per_event' | 'per_domain';
  attribution_window_days: number;
  soft_match_enabled: boolean;
  exclude_personal_domains: boolean;
  last_processed_at: string | null;
}

export function ClientSettingsTable() {
  const [clients, setClients] = useState<ClientSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ clientId: string; field: string } | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/clients/settings');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setClients(data);
    } catch {
      toast.error('Failed to load client settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const updateSetting = async (
    clientId: string,
    field: string,
    value: unknown
  ) => {
    setSaving(clientId);
    try {
      const response = await fetch('/api/admin/clients/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, [field]: value }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update');
      }

      // Update local state
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, [field]: value } : c))
      );
      toast.success('Setting updated');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(null);
      setEditingCell(null);
    }
  };

  const ModeSelect = ({
    clientId,
    field,
    value,
  }: {
    clientId: string;
    field: string;
    value: string;
  }) => (
    <Select
      value={value}
      onValueChange={(v) => updateSetting(clientId, field, v)}
      disabled={saving === clientId}
    >
      <SelectTrigger className="w-[120px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="per_event">Per Event</SelectItem>
        <SelectItem value="per_domain">Per Domain</SelectItem>
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading clients...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchClients}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px] sticky left-0 bg-muted/50">Client</TableHead>
              <TableHead className="text-center w-[80px]">Rev Share</TableHead>
              <TableHead className="text-center w-[120px]">Sign-ups</TableHead>
              <TableHead className="text-center w-[120px]">Meetings</TableHead>
              <TableHead className="text-center w-[120px]">Paying</TableHead>
              <TableHead className="text-center w-[80px]">Window</TableHead>
              <TableHead className="text-center w-[100px]">Soft Match</TableHead>
              <TableHead className="text-center w-[100px]">Excl. Personal</TableHead>
              <TableHead className="w-[100px]">Last Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                {/* Client Name */}
                <TableCell className="font-medium sticky left-0 bg-background">
                  <div>
                    {client.client_name}
                    <Badge variant="outline" className="ml-2 text-xs font-mono">
                      {client.slug}
                    </Badge>
                  </div>
                </TableCell>

                {/* Rev Share Rate */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'rev_share_rate' ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      defaultValue={client.rev_share_rate}
                      className="w-16 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0 && val <= 1) {
                          updateSetting(client.id, 'rev_share_rate', val);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors"
                      onClick={() =>
                        setEditingCell({ clientId: client.id, field: 'rev_share_rate' })
                      }
                    >
                      {(client.rev_share_rate * 100).toFixed(0)}%
                    </button>
                  )}
                </TableCell>

                {/* Sign-ups Mode */}
                <TableCell className="text-center">
                  <ModeSelect
                    clientId={client.id}
                    field="sign_ups_mode"
                    value={client.sign_ups_mode}
                  />
                </TableCell>

                {/* Meetings Mode */}
                <TableCell className="text-center">
                  <ModeSelect
                    clientId={client.id}
                    field="meetings_mode"
                    value={client.meetings_mode}
                  />
                </TableCell>

                {/* Paying Mode */}
                <TableCell className="text-center">
                  <ModeSelect
                    clientId={client.id}
                    field="paying_mode"
                    value={client.paying_mode}
                  />
                </TableCell>

                {/* Attribution Window */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'attribution_window_days' ? (
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      defaultValue={client.attribution_window_days}
                      className="w-16 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= 365) {
                          updateSetting(client.id, 'attribution_window_days', val);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors"
                      onClick={() =>
                        setEditingCell({
                          clientId: client.id,
                          field: 'attribution_window_days',
                        })
                      }
                    >
                      {client.attribution_window_days}d
                    </button>
                  )}
                </TableCell>

                {/* Soft Match Enabled */}
                <TableCell className="text-center">
                  <Switch
                    checked={client.soft_match_enabled}
                    onCheckedChange={(checked) =>
                      updateSetting(client.id, 'soft_match_enabled', checked)
                    }
                    disabled={saving === client.id}
                  />
                </TableCell>

                {/* Exclude Personal Domains */}
                <TableCell className="text-center">
                  <Switch
                    checked={client.exclude_personal_domains}
                    onCheckedChange={(checked) =>
                      updateSetting(client.id, 'exclude_personal_domains', checked)
                    }
                    disabled={saving === client.id}
                  />
                </TableCell>

                {/* Last Processed */}
                <TableCell className="text-xs text-muted-foreground">
                  {client.last_processed_at
                    ? new Date(client.last_processed_at).toLocaleDateString()
                    : 'Never'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {clients.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No clients found. Run a client sync first.
        </div>
      )}
    </div>
  );
}

