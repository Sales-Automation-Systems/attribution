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
  Loader2, Send, DollarSign, Building2,
  Calendar, Clock, FileCheck, AlertTriangle, ChevronRight
} from 'lucide-react';
import { format, differenceInDays, differenceInHours, isPast, addMonths, startOfMonth } from 'date-fns';

type ReconciliationStatusType = 'UPCOMING' | 'OPEN' | 'PENDING_CLIENT' | 'CLIENT_SUBMITTED' | 'UNDER_REVIEW' | 'AUTO_BILLED' | 'FINALIZED';
type LineStatusType = 'PENDING' | 'SUBMITTED' | 'DISPUTED' | 'CONFIRMED';
type MotionTypeValue = 'PLG' | 'SALES';
type BillingCycleType = 'monthly' | 'quarterly' | '28_day';

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
  billing_cycle: BillingCycleType;
  rev_share_rate: number;
  revshare_plg: number | null;
  revshare_sales: number | null;
  fee_per_signup: number | null;
  fee_per_meeting: number | null;
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
  revenue_month_1: number | null;
  revenue_month_2: number | null;
  revenue_month_3: number | null;
  revenue_submitted: number | null;
  revenue_notes: string | null;
  paying_customer_date: string | null;
  revshare_rate_applied: number | null;
  signup_fee_applied: number | null;
  meeting_fee_applied: number | null;
  amount_owed: number | null;
  status: LineStatusType;
  dispute_reason: string | null;
}

interface MonthlyRevenueInput {
  month1: string;
  month2: string;
  month3: string;
  notes: string;
}

interface RevenueInputState {
  [lineItemId: string]: MonthlyRevenueInput;
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
  const [revenueInputs, setRevenueInputs] = useState<RevenueInputState>({});
  const [clientNotes, setClientNotes] = useState('');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${slug}/${uuid}/reconciliation`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPeriods(data.periods || []);
      
      // Find first OPEN period (active or ready for input)
      const openPeriod = (data.periods || []).find((p: ReconciliationPeriod) => 
        p.status === 'OPEN' || p.status === 'PENDING_CLIENT'
      );
      if (openPeriod) {
        setActivePeriod(openPeriod);
        fetchLineItems(openPeriod.id);
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
      setLineItems(data.lineItems || []);
      
      // Initialize revenue inputs from existing data
      const inputs: RevenueInputState = {};
      (data.lineItems || []).forEach((item: LineItem) => {
        inputs[item.id] = {
          month1: item.revenue_month_1?.toString() || '',
          month2: item.revenue_month_2?.toString() || '',
          month3: item.revenue_month_3?.toString() || '',
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

  const selectPeriod = (period: ReconciliationPeriod) => {
    setActivePeriod(period);
    fetchLineItems(period.id);
  };

  const updateRevenueInput = (
    lineItemId: string, 
    field: 'month1' | 'month2' | 'month3' | 'notes', 
    value: string
  ) => {
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
    if (!input || !activePeriod) return;

    setSavingItem(lineItemId);
    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/reconciliation/${activePeriod.id}/items/${lineItemId}`, 
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revenue_month_1: input.month1 ? parseFloat(input.month1) : null,
            revenue_month_2: input.month2 ? parseFloat(input.month2) : null,
            revenue_month_3: input.month3 ? parseFloat(input.month3) : null,
            notes: input.notes || null,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save');
      toast.success('Revenue saved');
      
      // Refresh to get updated calculations
      fetchLineItems(activePeriod.id);
    } catch {
      toast.error('Failed to save revenue');
    } finally {
      setSavingItem(null);
    }
  };

  const submitReconciliation = async () => {
    if (!activePeriod) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/clients/${slug}/${uuid}/reconciliation/${activePeriod.id}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: clientNotes }),
        }
      );

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

  const getFilledCount = () => {
    return lineItems.filter(item => {
      const input = revenueInputs[item.id];
      if (!input) return false;
      const total = (parseFloat(input.month1) || 0) + 
                   (parseFloat(input.month2) || 0) + 
                   (parseFloat(input.month3) || 0);
      return total > 0;
    }).length;
  };

  const getTotalRevenue = () => {
    let total = 0;
    lineItems.forEach(item => {
      const input = revenueInputs[item.id];
      if (input) {
        total += (parseFloat(input.month1) || 0) + 
                 (parseFloat(input.month2) || 0) + 
                 (parseFloat(input.month3) || 0);
      }
    });
    return total;
  };

  const getDeadlineInfo = (period: ReconciliationPeriod) => {
    if (!period.review_deadline) return null;
    
    const deadline = new Date(period.review_deadline);
    const now = new Date();
    
    if (isPast(deadline)) {
      return { text: 'Overdue', isOverdue: true, daysLeft: 0, isUrgent: true };
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

  // Get month labels for the period
  const getMonthLabels = (period: ReconciliationPeriod): string[] => {
    const startDate = new Date(period.start_date);
    
    if (period.billing_cycle === 'quarterly') {
      // 3 months for quarterly
      return [
        format(startDate, 'MMMM yyyy'),
        format(addMonths(startOfMonth(startDate), 1), 'MMMM yyyy'),
        format(addMonths(startOfMonth(startDate), 2), 'MMMM yyyy'),
      ];
    }
    
    // Single month for monthly or 28-day
    return [format(startDate, 'MMMM yyyy')];
  };

  const isQuarterly = activePeriod?.billing_cycle === 'quarterly';

  // Split periods into current (OPEN) and upcoming (UPCOMING)
  const currentPeriods = periods.filter(p => p.status === 'OPEN' || p.status === 'PENDING_CLIENT');
  const upcomingPeriods = periods.filter(p => p.status === 'UPCOMING');
  const pastPeriods = periods.filter(p => 
    !['OPEN', 'PENDING_CLIENT', 'UPCOMING'].includes(p.status)
  );

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
            Enter the revenue collected from each paying customer
          </p>
        </div>
      </div>

      {/* Period Selection */}
      {currentPeriods.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Current Periods</CardTitle>
            <CardDescription>
              Enter revenue data for these periods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentPeriods.map((period) => {
              const deadlineInfo = getDeadlineInfo(period);
              const isActive = activePeriod?.id === period.id;
              
              return (
                <button
                  key={period.id}
                  onClick={() => selectPeriod(period)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isActive 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{period.period_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                    </span>
                    {isPast(new Date(period.end_date)) ? (
                      <Badge variant="secondary">Period Ended</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {deadlineInfo && (
                      <Badge 
                        variant={deadlineInfo.isOverdue ? 'destructive' : deadlineInfo.isUrgent ? 'default' : 'outline'}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {deadlineInfo.text}
                      </Badge>
                    )}
                    <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active Period Revenue Entry */}
      {activePeriod && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  {activePeriod.period_name}
                  <Badge variant="outline">
                    {activePeriod.total_paying_customers} customer{activePeriod.total_paying_customers !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Enter the revenue collected from each customer
                  {isQuarterly && ' - broken down by month'}
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

            {/* Line Items - Customer Revenue Entry */}
            {lineItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No paying customers in this period yet.
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item) => {
                  const input = revenueInputs[item.id] || { month1: '', month2: '', month3: '', notes: '' };
                  const monthLabels = getMonthLabels(activePeriod);
                  const total = (parseFloat(input.month1) || 0) + 
                               (parseFloat(input.month2) || 0) + 
                               (parseFloat(input.month3) || 0);
                  
                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{item.domain}</span>
                          <Badge variant={item.motion_type === 'PLG' ? 'outline' : 'secondary'}>
                            {item.motion_type || 'Unknown'}
                          </Badge>
                          {item.paying_customer_date && (
                            <span className="text-xs text-muted-foreground">
                              Became paying: {format(new Date(item.paying_customer_date), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {total > 0 && (
                            <span className="text-sm font-medium text-green-600">
                              Total: {formatCurrency(total)}
                            </span>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => saveLineItem(item.id)}
                            disabled={savingItem === item.id}
                          >
                            {savingItem === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Monthly Revenue Inputs */}
                      <div className={`grid gap-3 ${isQuarterly ? 'md:grid-cols-3' : 'md:grid-cols-1'}`}>
                        {/* Month 1 (always shown) */}
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">
                            {monthLabels[0]}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={input.month1}
                              onChange={(e) => updateRevenueInput(item.id, 'month1', e.target.value)}
                              placeholder="0"
                              className="pl-7"
                            />
                          </div>
                        </div>
                        
                        {/* Month 2 & 3 (quarterly only) */}
                        {isQuarterly && (
                          <>
                            <div>
                              <label className="text-sm text-muted-foreground mb-1 block">
                                {monthLabels[1]}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  value={input.month2}
                                  onChange={(e) => updateRevenueInput(item.id, 'month2', e.target.value)}
                                  placeholder="0"
                                  className="pl-7"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground mb-1 block">
                                {monthLabels[2]}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  value={input.month3}
                                  onChange={(e) => updateRevenueInput(item.id, 'month3', e.target.value)}
                                  placeholder="0"
                                  className="pl-7"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Notes */}
                      <div className="mt-3">
                        <Input
                          value={input.notes}
                          onChange={(e) => updateRevenueInput(item.id, 'notes', e.target.value)}
                          placeholder="Optional notes..."
                          className="text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Active Period */}
      {!activePeriod && currentPeriods.length === 0 && (
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
      {upcomingPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Periods</CardTitle>
            <CardDescription>
              These periods haven&apos;t started yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingPeriods.map((period) => (
                <div key={period.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{period.period_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <Badge variant="outline">Starts {format(new Date(period.start_date), 'MMM d')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Reconciliations */}
      {pastPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Reconciliations</CardTitle>
            <CardDescription>
              Previously submitted reconciliation periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {pastPeriods.map((period) => (
                <AccordionItem key={period.id} value={period.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4">
                      <span>{period.period_name}</span>
                      <Badge variant={period.status === 'FINALIZED' ? 'secondary' : 'outline'}>
                        {period.status === 'FINALIZED' ? 'Finalized' : 
                         period.status === 'AUTO_BILLED' ? 'Auto-Billed' : 
                         period.status === 'CLIENT_SUBMITTED' ? 'Submitted' : period.status}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <div className="text-sm text-muted-foreground">Paying Customers</div>
                        <div className="text-xl font-bold">{period.total_paying_customers}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Revenue Submitted</div>
                        <div className="text-xl font-bold">{formatCurrency(period.total_revenue_submitted)}</div>
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
                  <div className="text-muted-foreground">Total Revenue</div>
                  <div className="font-bold text-green-600">{formatCurrency(getTotalRevenue())}</div>
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
                placeholder="Any additional notes..."
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
