'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ClientNav } from '@/components/attribution/client-nav';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { 
  Loader2, Send, CheckCircle, DollarSign, Building2,
  Calendar, Clock, FileCheck, AlertTriangle
} from 'lucide-react';
import { format, differenceInDays, differenceInHours, isPast } from 'date-fns';
type ReconciliationStatusType = 'UPCOMING' | 'OPEN' | 'PENDING_CLIENT' | 'CLIENT_SUBMITTED' | 'UNDER_REVIEW' | 'AUTO_BILLED' | 'FINALIZED';
type LineStatusType = 'PENDING' | 'SUBMITTED' | 'DISPUTED' | 'CONFIRMED';
type MotionTypeValue = 'PLG' | 'SALES';

interface ReconciliationPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: ReconciliationStatusType;
  total_paying_customers: number;
  total_signups: number;
  total_meetings: number;
  total_revenue_submitted: number;
  total_amount_owed: number;
  agency_notes: string | null;
  client_notes: string | null;
  billing_model: string;
  rev_share_rate: number;
  revshare_plg: number | null;
  revshare_sales: number | null;
  fee_per_signup: number | null;
  fee_per_meeting: number | null;
  // Auto-reconciliation fields
  review_deadline: string | null;
  estimated_total: number | null;
  auto_generated: boolean;
}

interface LineItem {
  id: string;
  domain: string;
  motion_type: MotionTypeValue | null;
  signup_count: number;
  meeting_count: number;
  revenue_submitted: number | null;
  revenue_notes: string | null;
  revshare_rate_applied: number | null;
  signup_fee_applied: number | null;
  meeting_fee_applied: number | null;
  amount_owed: number | null;
  status: LineStatusType;
  dispute_reason: string | null;
}

const STATUS_CONFIG: Record<ReconciliationStatusType, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  UPCOMING: { label: 'Upcoming', variant: 'outline' },
  OPEN: { label: 'Action Required', variant: 'default' },
  PENDING_CLIENT: { label: 'Awaiting Your Input', variant: 'default' },
  CLIENT_SUBMITTED: { label: 'Submitted', variant: 'secondary' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'outline' },
  AUTO_BILLED: { label: 'Auto-Billed', variant: 'destructive' },
  FINALIZED: { label: 'Finalized', variant: 'secondary' },
};

interface RevenueInput {
  [lineItemId: string]: { revenue: string; notes: string };
}

export default function ClientReconciliationPage() {
  const params = useParams();
  const slug = params.slug as string;
  const uuid = params.uuid as string;

  const [periods, setPeriods] = useState<ReconciliationPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<ReconciliationPeriod | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Revenue inputs state
  const [revenueInputs, setRevenueInputs] = useState<RevenueInput>({});
  const [clientNotes, setClientNotes] = useState('');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${slug}/${uuid}/reconciliation`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPeriods(data.periods || []);
      
      // Find active period (OPEN or PENDING_CLIENT status)
      const actionable = (data.periods || []).find((p: ReconciliationPeriod) => 
        p.status === 'OPEN' || p.status === 'PENDING_CLIENT'
      );
      if (actionable) {
        setActivePeriod(actionable);
        fetchLineItems(actionable.id);
      }
    } catch {
      toast.error('Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [slug, uuid]);

  const fetchLineItems = async (periodId: string) => {
    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/reconciliation/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setLineItems(data.lineItems);
      
      // Initialize revenue inputs from existing data
      const inputs: RevenueInput = {};
      data.lineItems.forEach((item: LineItem) => {
        inputs[item.id] = {
          revenue: item.revenue_submitted?.toString() || '',
          notes: item.revenue_notes || '',
        };
      });
      setRevenueInputs(inputs);
    } catch {
      toast.error('Failed to load line items');
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const updateRevenueInput = (lineItemId: string, field: 'revenue' | 'notes', value: string) => {
    setRevenueInputs(prev => ({
      ...prev,
      [lineItemId]: {
        ...prev[lineItemId],
        [field]: value,
      },
    }));
  };

  const saveLineItem = async (lineItemId: string) => {
    const input = revenueInputs[lineItemId];
    if (!input) return;

    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/reconciliation/${activePeriod?.id}/items/${lineItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revenue: input.revenue ? parseFloat(input.revenue) : null,
          notes: input.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      toast.success('Revenue saved');
      
      // Refresh to get updated calculations
      if (activePeriod) {
        fetchLineItems(activePeriod.id);
      }
    } catch {
      toast.error('Failed to save revenue');
    }
  };

  const submitReconciliation = async () => {
    if (!activePeriod) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/clients/${slug}/${uuid}/reconciliation/${activePeriod.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: clientNotes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit');
      }

      toast.success('Reconciliation submitted successfully');
      setSubmitDialogOpen(false);
      fetchPeriods();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
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

  const calculateTotal = () => {
    let total = 0;
    lineItems.forEach(item => {
      if (item.amount_owed) total += item.amount_owed;
    });
    // Add signup and meeting fees
    if (activePeriod?.fee_per_signup) {
      total += activePeriod.total_signups * activePeriod.fee_per_signup;
    }
    if (activePeriod?.fee_per_meeting) {
      total += activePeriod.total_meetings * activePeriod.fee_per_meeting;
    }
    return total;
  };

  const getFilledCount = () => {
    return lineItems.filter(item => 
      revenueInputs[item.id]?.revenue && parseFloat(revenueInputs[item.id].revenue) > 0
    ).length;
  };

  const getDeadlineInfo = (period: ReconciliationPeriod) => {
    if (!period.review_deadline) return null;
    
    const deadline = new Date(period.review_deadline);
    const now = new Date();
    
    if (isPast(deadline)) {
      return { text: 'Overdue', isOverdue: true, daysLeft: 0 };
    }
    
    const daysLeft = differenceInDays(deadline, now);
    const hoursLeft = differenceInHours(deadline, now);
    
    if (daysLeft === 0) {
      return { text: `${hoursLeft} hours left`, isOverdue: false, daysLeft: 0, isUrgent: true };
    }
    
    return { 
      text: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, 
      isOverdue: false, 
      daysLeft,
      isUrgent: daysLeft <= 3
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Navigation */}
      <ClientNav slug={slug} uuid={uuid} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <DollarSign className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
          <p className="text-muted-foreground">
            Submit revenue data for your paying customers
          </p>
        </div>
      </div>

      {/* Active Reconciliation */}
      {activePeriod && (
        <>
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <Calendar className="h-5 w-5" />
                    {activePeriod.period_name}
                    <Badge variant={STATUS_CONFIG[activePeriod.status].variant}>
                      {STATUS_CONFIG[activePeriod.status].label}
                    </Badge>
                    {/* Deadline countdown */}
                    {activePeriod.review_deadline && (() => {
                      const deadlineInfo = getDeadlineInfo(activePeriod);
                      if (!deadlineInfo) return null;
                      return (
                        <Badge 
                          variant={deadlineInfo.isOverdue ? 'destructive' : deadlineInfo.isUrgent ? 'default' : 'outline'}
                          className="ml-2"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {deadlineInfo.text}
                        </Badge>
                      );
                    })()}
                  </CardTitle>
                  <CardDescription>
                    {format(new Date(activePeriod.start_date), 'MMM d')} - {format(new Date(activePeriod.end_date), 'MMM d, yyyy')}
                    {activePeriod.review_deadline && (
                      <span className="ml-2">
                        • Due by {format(new Date(activePeriod.review_deadline), 'MMM d, yyyy')}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setSubmitDialogOpen(true)}
                  disabled={getFilledCount() === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit ({getFilledCount()}/{lineItems.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Auto-bill warning */}
              {activePeriod.review_deadline && activePeriod.estimated_total && (() => {
                const deadlineInfo = getDeadlineInfo(activePeriod);
                if (deadlineInfo && (deadlineInfo.isUrgent || deadlineInfo.isOverdue)) {
                  return (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg mb-4 text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <strong>Auto-billing notice:</strong> If you don&apos;t submit by {format(new Date(activePeriod.review_deadline), 'MMMM d')}, 
                        we&apos;ll bill an estimated <strong>{formatCurrency(activePeriod.estimated_total)}</strong> based on default customer values.
                        You can always reconcile the actual amounts later.
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {activePeriod.agency_notes && (
                <div className="bg-muted p-3 rounded-lg mb-4">
                  <div className="text-sm font-medium mb-1">Note from agency:</div>
                  <div className="text-sm text-muted-foreground">{activePeriod.agency_notes}</div>
                </div>
              )}
              
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Building2 className="h-4 w-4" />
                    Paying Customers
                  </div>
                  <div className="text-2xl font-bold">{activePeriod.total_paying_customers}</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Your Rate
                  </div>
                  <div className="text-2xl font-bold">
                    {activePeriod.billing_model === 'plg_sales_split' 
                      ? `${formatPercent(activePeriod.revshare_plg)} / ${formatPercent(activePeriod.revshare_sales)}`
                      : formatPercent(activePeriod.rev_share_rate)
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activePeriod.billing_model === 'plg_sales_split' ? 'PLG / Sales' : 'Flat RevShare'}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Current Total Owed
                  </div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(calculateTotal())}</div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Customer (Domain)</TableHead>
                      <TableHead className="text-center">Motion</TableHead>
                      <TableHead className="text-center">Rate</TableHead>
                      <TableHead className="w-[180px]">Revenue</TableHead>
                      <TableHead className="w-[200px]">Notes</TableHead>
                      <TableHead className="text-right">Amount Owed</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.domain}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={item.motion_type === 'PLG' ? 'outline' : 'secondary'}>
                            {item.motion_type || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPercent(item.revshare_rate_applied)}
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={revenueInputs[item.id]?.revenue || ''}
                              onChange={(e) => updateRevenueInput(item.id, 'revenue', e.target.value)}
                              placeholder="0"
                              className="pl-7"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={revenueInputs[item.id]?.notes || ''}
                            onChange={(e) => updateRevenueInput(item.id, 'notes', e.target.value)}
                            placeholder="Optional notes..."
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount_owed)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => saveLineItem(item.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* No Active Period */}
      {!activePeriod && periods.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Reconciliation Pending</h2>
            <p className="text-muted-foreground">
              You&apos;re all caught up! There are no reconciliation periods awaiting your input.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Periods */}
      {periods.filter(p => p.status === 'UPCOMING').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Periods</CardTitle>
            <CardDescription>
              These periods haven&apos;t ended yet - reconciliation will open when the period ends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {periods.filter(p => p.status === 'UPCOMING').map((period) => (
                <div key={period.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{period.period_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <Badge variant="outline">Opens {format(new Date(period.end_date), 'MMM d')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Reconciliations */}
      {periods.filter(p => !['PENDING_CLIENT', 'OPEN', 'UPCOMING'].includes(p.status)).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Reconciliations</CardTitle>
            <CardDescription>
              Previously submitted and finalized reconciliation periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {periods.filter(p => !['PENDING_CLIENT', 'OPEN', 'UPCOMING'].includes(p.status)).map((period) => (
                <AccordionItem key={period.id} value={period.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4">
                      <span>{period.period_name}</span>
                      <Badge variant={STATUS_CONFIG[period.status].variant}>
                        {STATUS_CONFIG[period.status].label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <div className="text-sm text-muted-foreground">Paying Customers</div>
                        <div className="text-xl font-bold">{period.total_paying_customers}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Revenue Submitted</div>
                        <div className="text-xl font-bold">{formatCurrency(period.total_revenue_submitted)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Amount Owed</div>
                        <div className="text-xl font-bold text-green-600">{formatCurrency(period.total_amount_owed)}</div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Reconciliation</DialogTitle>
            <DialogDescription>
              You&apos;re about to submit your revenue data for {activePeriod?.period_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Customers Reported</div>
                  <div className="font-bold">{getFilledCount()} of {lineItems.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Amount Owed</div>
                  <div className="font-bold text-green-600">{formatCurrency(calculateTotal())}</div>
                </div>
              </div>
            </div>
            
            {getFilledCount() < lineItems.length && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  You haven&apos;t entered revenue for all customers. You can still submit, but incomplete data may delay the review process.
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <Textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Any additional notes for the agency..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReconciliation} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
