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
  Loader2, Send, DollarSign,
  Calendar, Clock, FileCheck, AlertTriangle
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
        format(startDate, 'MMM yyyy'),
        format(addMonths(startOfMonth(startDate), 1), 'MMM yyyy'),
        format(addMonths(startOfMonth(startDate), 2), 'MMM yyyy'),
      ];
    }
    
    // Single month for monthly or 28-day
    return [format(startDate, 'MMM yyyy')];
  };

  const isQuarterly = activePeriod?.billing_cycle === 'quarterly';

  // Split periods into current (OPEN) and upcoming (UPCOMING)
  // Sort by start_date chronologically
  const sortedPeriods = [...periods].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  
  const currentPeriods = sortedPeriods.filter(p => p.status === 'OPEN' || p.status === 'PENDING_CLIENT');
  const upcomingPeriods = sortedPeriods.filter(p => p.status === 'UPCOMING');
  const pastPeriods = sortedPeriods.filter(p => 
    !['OPEN', 'PENDING_CLIENT', 'UPCOMING'].includes(p.status)
  );

  // Only show the next upcoming period
  const nextUpcomingPeriod = upcomingPeriods[0];

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

      {/* Upcoming Period (show only next one, at top) */}
      {nextUpcomingPeriod && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Upcoming: {nextUpcomingPeriod.period_name}</CardTitle>
                <Badge variant="outline">
                  Starts {format(new Date(nextUpcomingPeriod.start_date), 'MMM d, yyyy')}
                </Badge>
              </div>
            </div>
            <CardDescription>
              {format(new Date(nextUpcomingPeriod.start_date), 'MMM d')} - {format(new Date(nextUpcomingPeriod.end_date), 'MMM d, yyyy')}
              {' • '}Revenue entry will open when this period starts
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Current Periods */}
      {currentPeriods.length > 0 && (
        <div className="space-y-4">
          {currentPeriods.map((period) => {
            const isActive = activePeriod?.id === period.id;
            const deadlineInfo = getDeadlineInfo(period);
            const monthLabels = getMonthLabels(period);
            
            return (
              <Card 
                key={period.id} 
                className={isActive ? 'border-primary' : 'cursor-pointer hover:border-primary/50'}
                onClick={() => !isActive && selectPeriod(period)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{period.period_name}</CardTitle>
                      <Badge variant={isPast(new Date(period.end_date)) ? 'secondary' : 'outline'}>
                        {isPast(new Date(period.end_date)) ? 'Period Ended' : 'Active'}
                      </Badge>
                      {deadlineInfo && (
                        <Badge 
                          variant={deadlineInfo.isOverdue ? 'destructive' : deadlineInfo.isUrgent ? 'default' : 'outline'}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {deadlineInfo.text}
                        </Badge>
                      )}
                    </div>
                    {isActive && (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); setSubmitDialogOpen(true); }}
                        disabled={getFilledCount() === 0}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit ({getFilledCount()}/{lineItems.length})
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                    {' • '}{period.total_paying_customers} paying customer{period.total_paying_customers !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                
                {isActive && (
                  <CardContent>
                    {/* Auto-bill warning */}
                    {period.review_deadline && period.estimated_total && deadlineInfo && (deadlineInfo.isUrgent || deadlineInfo.isOverdue) && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg mb-4 text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <strong>Auto-billing notice:</strong> If you don&apos;t submit by {format(new Date(period.review_deadline), 'MMMM d')}, 
                          we&apos;ll bill an estimated <strong>{formatCurrency(period.estimated_total)}</strong> based on default customer values.
                        </div>
                      </div>
                    )}

                    {period.agency_notes && (
                      <div className="bg-muted p-3 rounded-lg mb-4">
                        <div className="text-sm font-medium mb-1">Note from agency:</div>
                        <div className="text-sm text-muted-foreground">{period.agency_notes}</div>
                      </div>
                    )}

                    {/* Line Items Table */}
                    {lineItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No paying customers in this period yet.
                      </div>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[200px]">Domain</TableHead>
                              <TableHead className="w-[120px]">Became Paying</TableHead>
                              {isQuarterly ? (
                                <>
                                  <TableHead className="text-center w-[130px]">{monthLabels[0]}</TableHead>
                                  <TableHead className="text-center w-[130px]">{monthLabels[1]}</TableHead>
                                  <TableHead className="text-center w-[130px]">{monthLabels[2]}</TableHead>
                                </>
                              ) : (
                                <TableHead className="text-center w-[150px]">{monthLabels[0]}</TableHead>
                              )}
                              <TableHead className="text-right w-[100px]">Total</TableHead>
                              <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item) => {
                              const input = revenueInputs[item.id] || { month1: '', month2: '', month3: '', notes: '' };
                              const total = (parseFloat(input.month1) || 0) + 
                                           (parseFloat(input.month2) || 0) + 
                                           (parseFloat(input.month3) || 0);
                              
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    {item.domain}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.paying_customer_date 
                                      ? format(new Date(item.paying_customer_date), 'MMM d, yyyy')
                                      : '-'}
                                  </TableCell>
                                  {/* Month 1 */}
                                  <TableCell>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                      <Input
                                        type="number"
                                        value={input.month1}
                                        onChange={(e) => updateRevenueInput(item.id, 'month1', e.target.value)}
                                        placeholder="0"
                                        className="pl-6 h-8 text-sm"
                                      />
                                    </div>
                                  </TableCell>
                                  {/* Month 2 & 3 for quarterly */}
                                  {isQuarterly && (
                                    <>
                                      <TableCell>
                                        <div className="relative">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                          <Input
                                            type="number"
                                            value={input.month2}
                                            onChange={(e) => updateRevenueInput(item.id, 'month2', e.target.value)}
                                            placeholder="0"
                                            className="pl-6 h-8 text-sm"
                                          />
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="relative">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                          <Input
                                            type="number"
                                            value={input.month3}
                                            onChange={(e) => updateRevenueInput(item.id, 'month3', e.target.value)}
                                            placeholder="0"
                                            className="pl-6 h-8 text-sm"
                                          />
                                        </div>
                                      </TableCell>
                                    </>
                                  )}
                                  <TableCell className="text-right font-medium">
                                    {total > 0 ? formatCurrency(total) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); saveLineItem(item.id); }}
                                      disabled={savingItem === item.id}
                                      className="h-8"
                                    >
                                      {savingItem === item.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Save'
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* No Active Period */}
      {currentPeriods.length === 0 && !nextUpcomingPeriod && (
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
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(period.start_date), 'MMM d')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                      </span>
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
