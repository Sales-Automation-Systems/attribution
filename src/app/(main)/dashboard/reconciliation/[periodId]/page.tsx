'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, Send, CheckCircle, RefreshCw, 
  AlertCircle, Download, DollarSign, Building2, Users,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
type ReconciliationStatusType = 'DRAFT' | 'PENDING_CLIENT' | 'CLIENT_SUBMITTED' | 'UNDER_REVIEW' | 'FINALIZED';
type LineStatusType = 'PENDING' | 'SUBMITTED' | 'DISPUTED' | 'CONFIRMED';
type MotionTypeValue = 'PLG' | 'SALES';

interface ReconciliationPeriodDetail {
  id: string;
  client_config_id: string;
  client_name: string;
  client_slug: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: ReconciliationStatusType;
  created_by: string | null;
  created_at: string;
  sent_to_client_at: string | null;
  client_submitted_at: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  total_signups: number;
  total_meetings: number;
  total_paying_customers: number;
  total_revenue_submitted: number;
  total_amount_owed: number;
  agency_notes: string | null;
  client_notes: string | null;
  // Client billing config
  billing_model: string;
  rev_share_rate: number;
  revshare_plg: number | null;
  revshare_sales: number | null;
  fee_per_signup: number | null;
  fee_per_meeting: number | null;
}

interface LineItem {
  id: string;
  reconciliation_period_id: string;
  attributed_domain_id: string | null;
  domain: string;
  motion_type: MotionTypeValue | null;
  signup_count: number;
  meeting_count: number;
  revenue_submitted: number | null;
  revenue_submitted_at: string | null;
  revenue_notes: string | null;
  revshare_rate_applied: number | null;
  signup_fee_applied: number | null;
  meeting_fee_applied: number | null;
  amount_owed: number | null;
  status: LineStatusType;
  dispute_reason: string | null;
  dispute_submitted_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
}

const STATUS_CONFIG: Record<ReconciliationStatusType, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  DRAFT: { label: 'Draft', variant: 'secondary', color: 'text-gray-500' },
  PENDING_CLIENT: { label: 'Awaiting Client', variant: 'outline', color: 'text-yellow-600' },
  CLIENT_SUBMITTED: { label: 'Client Submitted', variant: 'default', color: 'text-blue-600' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'default', color: 'text-purple-600' },
  FINALIZED: { label: 'Finalized', variant: 'secondary', color: 'text-green-600' },
};

const LINE_STATUS_CONFIG: Record<LineStatusType, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  PENDING: { label: 'Pending', variant: 'outline' },
  SUBMITTED: { label: 'Submitted', variant: 'default' },
  DISPUTED: { label: 'Disputed', variant: 'destructive' },
  CONFIRMED: { label: 'Confirmed', variant: 'secondary' },
};

export default function ReconciliationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<ReconciliationPeriodDetail | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchPeriod = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reconciliation/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPeriod(data.period);
      setLineItems(data.lineItems);
    } catch {
      toast.error('Failed to load reconciliation period');
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    fetchPeriod();
  }, [fetchPeriod]);

  const updateStatus = async (newStatus: ReconciliationStatusType) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/reconciliation/${periodId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update');
      }

      toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
      setSendDialogOpen(false);
      setFinalizeDialogOpen(false);
      setNotes('');
      fetchPeriod();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (rate: number | null) => {
    if (rate === null || rate === undefined) return '-';
    return `${(rate * 100).toFixed(0)}%`;
  };

  const calculateSignupFees = () => {
    if (!period?.fee_per_signup) return 0;
    return period.total_signups * period.fee_per_signup;
  };

  const calculateMeetingFees = () => {
    if (!period?.fee_per_meeting) return 0;
    return period.total_meetings * period.fee_per_meeting;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Period Not Found</h2>
          <p className="text-muted-foreground mb-4">This reconciliation period doesn&apos;t exist.</p>
          <Link href="/dashboard/reconciliation">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[period.status];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/reconciliation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{period.client_name}</h1>
              <Badge variant="outline" className="font-mono">{period.client_slug}</Badge>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {period.period_name}
              </span>
              <span>
                {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPeriod}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          {/* Status Actions */}
          {period.status === 'DRAFT' && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send to Client
            </Button>
          )}
          {period.status === 'CLIENT_SUBMITTED' && (
            <Button onClick={() => updateStatus('UNDER_REVIEW')}>
              Start Review
            </Button>
          )}
          {period.status === 'UNDER_REVIEW' && (
            <Button onClick={() => setFinalizeDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalize
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Paying Customers
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {period.total_paying_customers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {period.billing_model === 'plg_sales_split' ? (
                <>PLG: {formatPercent(period.revshare_plg)} / Sales: {formatPercent(period.revshare_sales)}</>
              ) : (
                <>Flat RevShare: {formatPercent(period.rev_share_rate)}</>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sign-ups / Meetings
            </CardDescription>
            <CardTitle className="text-3xl">
              {period.total_signups} / {period.total_meetings}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {period.fee_per_signup && <span>${period.fee_per_signup}/signup </span>}
              {period.fee_per_meeting && <span>${period.fee_per_meeting}/meeting</span>}
              {!period.fee_per_signup && !period.fee_per_meeting && <span>No per-event fees</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue Submitted
            </CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(period.total_revenue_submitted)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {lineItems.filter(li => li.revenue_submitted !== null).length} of {lineItems.length} submitted
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Amount Owed
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {formatCurrency(period.total_amount_owed + calculateSignupFees() + calculateMeetingFees())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1">
              {period.total_revenue_submitted > 0 && (
                <div>RevShare: {formatCurrency(period.total_amount_owed)}</div>
              )}
              {calculateSignupFees() > 0 && (
                <div>Signup fees: {formatCurrency(calculateSignupFees())}</div>
              )}
              {calculateMeetingFees() > 0 && (
                <div>Meeting fees: {formatCurrency(calculateMeetingFees())}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {(period.agency_notes || period.client_notes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {period.agency_notes && (
              <div>
                <span className="text-sm font-medium">Agency: </span>
                <span className="text-sm text-muted-foreground">{period.agency_notes}</span>
              </div>
            )}
            {period.client_notes && (
              <div>
                <span className="text-sm font-medium">Client: </span>
                <span className="text-sm text-muted-foreground">{period.client_notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Paying Customers</CardTitle>
          <CardDescription>
            Revenue submissions for each paying customer in this period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No paying customers found in this period.
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-center">Motion</TableHead>
                    <TableHead className="text-center">Sign-ups</TableHead>
                    <TableHead className="text-center">Meetings</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                    <TableHead className="text-right">Amount Owed</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => {
                    const lineStatusConfig = LINE_STATUS_CONFIG[item.status];
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.domain}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={item.motion_type === 'PLG' ? 'outline' : 'secondary'}>
                            {item.motion_type || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.signup_count}</TableCell>
                        <TableCell className="text-center">{item.meeting_count}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.revenue_submitted)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPercent(item.revshare_rate_applied)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount_owed)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={lineStatusConfig.variant}>
                            {lineStatusConfig.label}
                          </Badge>
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

      {/* Send to Client Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Client</DialogTitle>
            <DialogDescription>
              This will send the reconciliation to {period.client_name} for revenue submission.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Add a note for the client (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateStatus('PENDING_CLIENT')} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send to Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Dialog */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Reconciliation</DialogTitle>
            <DialogDescription>
              This will mark the reconciliation as complete. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg mb-4">
              <div className="text-sm font-medium">Summary</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(period.total_amount_owed + calculateSignupFees() + calculateMeetingFees())}
              </div>
              <div className="text-xs text-muted-foreground">Total amount owed by client</div>
            </div>
            <Textarea
              placeholder="Final notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateStatus('FINALIZED')} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

