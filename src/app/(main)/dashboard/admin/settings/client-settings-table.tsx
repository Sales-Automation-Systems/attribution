'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  // Billing model fields
  billing_model: 'flat_revshare' | 'plg_sales_split';
  revshare_plg: number | null;
  revshare_sales: number | null;
  fee_per_signup: number | null;
  fee_per_meeting: number | null;
  reconciliation_interval: 'monthly' | 'quarterly' | 'custom';
  // Auto-reconciliation fields
  contract_start_date: string | null;
  billing_cycle: 'monthly' | 'quarterly' | '28_day';
  estimated_acv: number;
  review_window_days: number;
  // Custom event fields
  custom_event_name: string | null;
  fee_per_custom_event: number | null;
}

function BillingModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <Select value={value || 'flat_revshare'} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[130px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="flat_revshare">Flat RevShare</SelectItem>
        <SelectItem value="plg_sales_split">PLG/Sales Split</SelectItem>
      </SelectContent>
    </Select>
  );
}


function BillingCycleSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <Select value={value || 'monthly'} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[100px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="monthly">Monthly</SelectItem>
        <SelectItem value="quarterly">Quarterly</SelectItem>
        <SelectItem value="28_day">28-Day</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ClientSettingsTable() {
  const [clients, setClients] = useState<ClientSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ clientId: string; field: string } | null>(null);

  const fetchClients = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

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
        const errorData = await response.json();
        throw new Error(errorData.error ?? 'Failed to update');
      }

      // Update local state
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, [field]: value } : c))
      );
      toast.success('Setting updated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(null);
      setEditingCell(null);
    }
  };

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
              <TableHead className="w-[180px] sticky left-0 z-20 bg-muted border-r">Client</TableHead>
              <TableHead className="text-center w-[130px]">Billing Model</TableHead>
              <TableHead className="text-center w-[80px]">Rev Share</TableHead>
              <TableHead className="text-center w-[80px]">PLG %</TableHead>
              <TableHead className="text-center w-[80px]">Sales %</TableHead>
              <TableHead className="text-center w-[80px]">$/Signup</TableHead>
              <TableHead className="text-center w-[80px]">$/Meeting</TableHead>
              <TableHead className="text-center w-[110px]">Custom Event</TableHead>
              <TableHead className="text-center w-[80px]">$/Custom</TableHead>
              <TableHead className="text-center w-[110px]">Contract Start</TableHead>
              <TableHead className="text-center w-[100px]">Billing Cycle</TableHead>
              <TableHead className="text-center w-[90px]">Est. ACV</TableHead>
              <TableHead className="text-center w-[80px]">Review Days</TableHead>
              <TableHead className="w-[100px]">Last Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                {/* Client Name */}
                <TableCell className="font-medium sticky left-0 z-10 bg-background border-r">
                  {client.client_name}
                </TableCell>

                {/* Billing Model */}
                <TableCell className="text-center">
                  <BillingModelSelect
                    value={client.billing_model}
                    onChange={(v) => updateSetting(client.id, 'billing_model', v)}
                    disabled={saving === client.id}
                  />
                </TableCell>

                {/* Rev Share Rate */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'rev_share_rate' ? (
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      defaultValue={(client.rev_share_rate * 100).toFixed(0)}
                      className="w-16 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0 && val <= 100) {
                          updateSetting(client.id, 'rev_share_rate', val / 100);
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
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                      onClick={() =>
                        setEditingCell({ clientId: client.id, field: 'rev_share_rate' })
                      }
                    >
                      {(client.rev_share_rate * 100).toFixed(0)}%
                    </button>
                  )}
                </TableCell>

                {/* PLG RevShare Rate */}
                <TableCell className="text-center">
                  {client.billing_model === 'plg_sales_split' ? (
                    editingCell?.clientId === client.id &&
                    editingCell?.field === 'revshare_plg' ? (
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        defaultValue={client.revshare_plg != null ? (client.revshare_plg * 100).toFixed(0) : ''}
                        className="w-16 h-8 text-xs text-center"
                        autoFocus
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            updateSetting(client.id, 'revshare_plg', val / 100);
                          } else if (e.target.value === '') {
                            updateSetting(client.id, 'revshare_plg', null);
                          } else {
                            setEditingCell(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <button
                        className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                        onClick={() => setEditingCell({ clientId: client.id, field: 'revshare_plg' })}
                      >
                        {client.revshare_plg != null ? `${(client.revshare_plg * 100).toFixed(0)}%` : '-'}
                      </button>
                    )
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                {/* Sales RevShare Rate */}
                <TableCell className="text-center">
                  {client.billing_model === 'plg_sales_split' ? (
                    editingCell?.clientId === client.id &&
                    editingCell?.field === 'revshare_sales' ? (
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        defaultValue={client.revshare_sales != null ? (client.revshare_sales * 100).toFixed(0) : ''}
                        className="w-16 h-8 text-xs text-center"
                        autoFocus
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            updateSetting(client.id, 'revshare_sales', val / 100);
                          } else if (e.target.value === '') {
                            updateSetting(client.id, 'revshare_sales', null);
                          } else {
                            setEditingCell(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <button
                        className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                        onClick={() => setEditingCell({ clientId: client.id, field: 'revshare_sales' })}
                      >
                        {client.revshare_sales != null ? `${(client.revshare_sales * 100).toFixed(0)}%` : '-'}
                      </button>
                    )
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                {/* Fee per Signup */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'fee_per_signup' ? (
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={client.fee_per_signup ?? ''}
                      className="w-16 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          updateSetting(client.id, 'fee_per_signup', val);
                        } else if (e.target.value === '') {
                          updateSetting(client.id, 'fee_per_signup', null);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'fee_per_signup' })}
                    >
                      {client.fee_per_signup != null ? `$${client.fee_per_signup}` : '-'}
                    </button>
                  )}
                </TableCell>

                {/* Fee per Meeting */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'fee_per_meeting' ? (
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={client.fee_per_meeting ?? ''}
                      className="w-16 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          updateSetting(client.id, 'fee_per_meeting', val);
                        } else if (e.target.value === '') {
                          updateSetting(client.id, 'fee_per_meeting', null);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'fee_per_meeting' })}
                    >
                      {client.fee_per_meeting != null ? `$${client.fee_per_meeting}` : '-'}
                    </button>
                  )}
                </TableCell>

                {/* Custom Event Name */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'custom_event_name' ? (
                    <Input
                      type="text"
                      maxLength={100}
                      defaultValue={client.custom_event_name ?? ''}
                      className="w-24 h-8 text-xs text-center"
                      placeholder="e.g., Proposal"
                      autoFocus
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        updateSetting(client.id, 'custom_event_name', val || null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline text-xs"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'custom_event_name' })}
                    >
                      {client.custom_event_name || '-'}
                    </button>
                  )}
                </TableCell>

                {/* Fee per Custom Event */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'fee_per_custom_event' ? (
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={client.fee_per_custom_event ?? ''}
                      className="w-16 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          updateSetting(client.id, 'fee_per_custom_event', val);
                        } else if (e.target.value === '') {
                          updateSetting(client.id, 'fee_per_custom_event', null);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'fee_per_custom_event' })}
                    >
                      {client.fee_per_custom_event != null ? `$${client.fee_per_custom_event}` : '-'}
                    </button>
                  )}
                </TableCell>

                {/* Contract Start Date */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'contract_start_date' ? (
                    <Input
                      type="date"
                      defaultValue={client.contract_start_date || ''}
                      className="w-[120px] h-8 text-xs"
                      autoFocus
                      onBlur={(e) => {
                        const val = e.target.value;
                        updateSetting(client.id, 'contract_start_date', val || null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors text-xs"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'contract_start_date' })}
                    >
                      {client.contract_start_date
                        ? new Date(client.contract_start_date).toLocaleDateString()
                        : '-'}
                    </button>
                  )}
                </TableCell>

                {/* Billing Cycle */}
                <TableCell className="text-center">
                  <BillingCycleSelect
                    value={client.billing_cycle}
                    onChange={(v) => updateSetting(client.id, 'billing_cycle', v)}
                    disabled={saving === client.id}
                  />
                </TableCell>

                {/* Estimated ACV */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'estimated_acv' ? (
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      defaultValue={client.estimated_acv}
                      className="w-20 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          updateSetting(client.id, 'estimated_acv', val);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'estimated_acv' })}
                    >
                      ${client.estimated_acv?.toLocaleString() || '10,000'}
                    </button>
                  )}
                </TableCell>

                {/* Review Window Days */}
                <TableCell className="text-center">
                  {editingCell?.clientId === client.id &&
                  editingCell?.field === 'review_window_days' ? (
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      defaultValue={client.review_window_days}
                      className="w-14 h-8 text-xs text-center"
                      autoFocus
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= 30) {
                          updateSetting(client.id, 'review_window_days', val);
                        } else {
                          setEditingCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <button
                      className="px-2 py-1 rounded hover:bg-muted transition-colors cursor-pointer underline-offset-2 hover:underline"
                      onClick={() => setEditingCell({ clientId: client.id, field: 'review_window_days' })}
                    >
                      {client.review_window_days || 10}d
                    </button>
                  )}
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
