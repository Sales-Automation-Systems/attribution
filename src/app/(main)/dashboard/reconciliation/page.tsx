'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Loader2, Plus, CalendarIcon, Eye, FileText, RefreshCw, DollarSign, Zap, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import Link from 'next/link';
type ReconciliationStatusType = 'UPCOMING' | 'OPEN' | 'PENDING_CLIENT' | 'CLIENT_SUBMITTED' | 'UNDER_REVIEW' | 'AUTO_BILLED' | 'FINALIZED';

interface ClientOption {
  id: string;
  client_name: string;
  slug: string;
  billing_model: string;
  rev_share_rate: number;
  revshare_plg: number | null;
  revshare_sales: number | null;
  reconciliation_interval: string;
  contract_start_date: string | null;
  billing_cycle: string;
  estimated_acv: number;
}

interface ReconciliationPeriod {
  id: string;
  client_config_id: string;
  client_name: string;
  client_slug: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: ReconciliationStatusType;
  total_paying_customers: number;
  total_revenue_submitted: number;
  total_amount_owed: number;
  created_at: string;
  finalized_at: string | null;
  // Auto-reconciliation fields
  review_deadline: string | null;
  estimated_total: number | null;
  auto_generated: boolean;
  auto_billed_at: string | null;
}

interface PreviewData {
  paying_customers: number;
  signups: number;
  meetings: number;
}

const STATUS_CONFIG: Record<ReconciliationStatusType, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  UPCOMING: { label: 'Upcoming', variant: 'outline' },
  OPEN: { label: 'Open', variant: 'default' },
  PENDING_CLIENT: { label: 'Awaiting Client', variant: 'outline' },
  CLIENT_SUBMITTED: { label: 'Client Submitted', variant: 'default' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'default' },
  AUTO_BILLED: { label: 'Auto-Billed', variant: 'destructive' },
  FINALIZED: { label: 'Finalized', variant: 'secondary' },
};

export default function ReconciliationDashboard() {
  const [periods, setPeriods] = useState<ReconciliationPeriod[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Form state
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [periodName, setPeriodName] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState<string>('');

  // Sync & auto-bill state
  const [syncing, setSyncing] = useState(false);
  const [autoBilling, setAutoBilling] = useState(false);
  const [overdueCounts, setOverdueCounts] = useState<{ count: number }>({ count: 0 });

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reconciliation');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPeriods(data);
    } catch {
      toast.error('Failed to load reconciliation periods');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/clients/settings');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setClients(data);
    } catch {
      toast.error('Failed to load clients');
    }
  }, []);

  const fetchOverdueCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/reconciliation/auto-bill');
      if (response.ok) {
        const data = await response.json();
        setOverdueCounts({ count: data.count || 0 });
      }
    } catch {
      // Ignore errors for overdue check
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
    fetchClients();
    fetchOverdueCounts();
  }, [fetchPeriods, fetchClients, fetchOverdueCounts]);

  const syncAllPeriods = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/reconciliation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true }),
      });

      if (!response.ok) throw new Error('Sync failed');
      
      const data = await response.json();
      toast.success(`Synced ${data.totalClients} clients, created ${data.results.reduce((acc: number, r: { periodsCreated: number }) => acc + r.periodsCreated, 0)} new periods`);
      fetchPeriods();
      fetchOverdueCounts();
    } catch {
      toast.error('Failed to sync periods');
    } finally {
      setSyncing(false);
    }
  };

  const runAutoBilling = async () => {
    if (overdueCounts.count === 0) {
      toast.info('No overdue periods to process');
      return;
    }

    setAutoBilling(true);
    try {
      const response = await fetch('/api/reconciliation/auto-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error('Auto-billing failed');
      
      const data = await response.json();
      toast.success(`Auto-billed ${data.processed} overdue periods`);
      fetchPeriods();
      fetchOverdueCounts();
    } catch {
      toast.error('Failed to run auto-billing');
    } finally {
      setAutoBilling(false);
    }
  };

  const applyPreset = (preset: string) => {
    const now = new Date();
    let start: Date, end: Date, name: string;

    switch (preset) {
      case 'this_month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        name = format(now, 'MMMM yyyy');
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        name = format(lastMonth, 'MMMM yyyy');
        break;
      case 'this_quarter':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        name = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
        break;
      case 'last_quarter':
        const lastQuarter = subQuarters(now, 1);
        start = startOfQuarter(lastQuarter);
        end = endOfQuarter(lastQuarter);
        name = `Q${Math.ceil((lastQuarter.getMonth() + 1) / 3)} ${lastQuarter.getFullYear()}`;
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
    setPeriodName(name);
    setPreviewData(null);
  };

  const fetchPreview = async () => {
    if (!selectedClient || !startDate || !endDate) {
      toast.error('Please select a client and date range first');
      return;
    }

    setPreviewing(true);
    try {
      const response = await fetch('/api/reconciliation/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch preview');
      const data = await response.json();
      setPreviewData(data);
    } catch {
      toast.error('Failed to preview reconciliation data');
    } finally {
      setPreviewing(false);
    }
  };

  const createReconciliation = async () => {
    if (!selectedClient || !startDate || !endDate || !periodName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          periodName,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create');
      }

      toast.success('Reconciliation period created');
      setCreateOpen(false);
      resetForm();
      fetchPeriods();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setPeriodName('');
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
    setPreviewData(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
            <p className="text-muted-foreground">
              Manage billing periods and client revenue submissions
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPeriods} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={syncAllPeriods} disabled={syncing}>
            <Zap className={`h-4 w-4 mr-2 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Periods'}
          </Button>
          {overdueCounts.count > 0 && (
            <Button variant="destructive" size="sm" onClick={runAutoBilling} disabled={autoBilling}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              {autoBilling ? 'Processing...' : `Auto-Bill (${overdueCounts.count})`}
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Reconciliation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create Reconciliation Period</DialogTitle>
                <DialogDescription>
                  Create a new billing period for a client to submit their revenue data.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Client Selection */}
                <div className="grid gap-2">
                  <Label htmlFor="client">Client</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name}
                          <span className="ml-2 text-muted-foreground text-xs">
                            ({client.billing_model === 'plg_sales_split' ? 'PLG/Sales' : 'Flat'})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Presets */}
                <div className="grid gap-2">
                  <Label>Quick Select</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => applyPreset('this_month')}>
                      This Month
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset('last_month')}>
                      Last Month
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset('this_quarter')}>
                      This Quarter
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset('last_quarter')}>
                      Last Quarter
                    </Button>
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => { setStartDate(date); setPreviewData(null); }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => { setEndDate(date); setPreviewData(null); }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Period Name */}
                <div className="grid gap-2">
                  <Label htmlFor="period-name">Period Name</Label>
                  <Input
                    id="period-name"
                    value={periodName}
                    onChange={(e) => setPeriodName(e.target.value)}
                    placeholder="e.g., December 2024, Q4 2024"
                  />
                </div>

                {/* Notes */}
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes for this reconciliation period..."
                    rows={2}
                  />
                </div>

                {/* Preview Button */}
                <Button
                  variant="outline"
                  onClick={fetchPreview}
                  disabled={!selectedClient || !startDate || !endDate || previewing}
                >
                  {previewing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Data
                    </>
                  )}
                </Button>

                {/* Preview Results */}
                {previewData && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-600">{previewData.paying_customers}</div>
                          <div className="text-xs text-muted-foreground">Paying Customers</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{previewData.signups}</div>
                          <div className="text-xs text-muted-foreground">Sign-ups</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{previewData.meetings}</div>
                          <div className="text-xs text-muted-foreground">Meetings</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createReconciliation} disabled={creating || !selectedClient || !startDate || !endDate || !periodName}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Reconciliations</CardDescription>
            <CardTitle className="text-3xl">
              {periods.filter(p => p.status !== 'FINALIZED').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting Client Input</CardDescription>
            <CardTitle className="text-3xl">
              {periods.filter(p => p.status === 'PENDING_CLIENT').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Under Review</CardDescription>
            <CardTitle className="text-3xl">
              {periods.filter(p => p.status === 'CLIENT_SUBMITTED' || p.status === 'UNDER_REVIEW').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Finalized</CardDescription>
            <CardTitle className="text-3xl">
              {periods.filter(p => p.status === 'FINALIZED').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Reconciliation Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reconciliation Periods</CardTitle>
          <CardDescription>
            Click on a period to view details and manage line items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reconciliation periods yet. Create one to get started.
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Client</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Paying Customers</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Amount Owed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => {
                    const statusConfig = STATUS_CONFIG[period.status];
                    return (
                      <TableRow key={period.id}>
                        <TableCell className="font-medium">
                          {period.client_name}
                          <Badge variant="outline" className="ml-2 text-xs font-mono">
                            {period.client_slug}
                          </Badge>
                        </TableCell>
                        <TableCell>{period.period_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusConfig.variant}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{period.total_paying_customers}</TableCell>
                        <TableCell className="text-right">
                          {period.total_revenue_submitted > 0
                            ? formatCurrency(period.total_revenue_submitted)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {period.total_amount_owed > 0
                            ? formatCurrency(period.total_amount_owed)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/reconciliation/${period.id}`}>
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

