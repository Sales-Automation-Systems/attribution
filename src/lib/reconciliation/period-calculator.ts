/**
 * Period Calculator for Auto-Reconciliation
 * 
 * Calculates billing periods based on contract start date and billing cycle.
 * Supports monthly, quarterly, and 28-day rolling periods.
 */

import { 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter,
  addDays,
  addMonths,
  addQuarters,
  isBefore,
  isAfter,
  format,
  differenceInDays
} from 'date-fns';

export type BillingCycle = 'monthly' | 'quarterly' | '28_day';

export interface BillingPeriod {
  start_date: Date;
  end_date: Date;
  review_deadline: Date;
  period_name: string;
  status: 'UPCOMING' | 'OPEN' | 'OVERDUE';
}

export interface PeriodCalculatorOptions {
  contractStartDate: Date;
  billingCycle: BillingCycle;
  reviewWindowDays: number;
  upToDate?: Date; // Defaults to today
}

/**
 * Calculate all billing periods from contract start to now
 */
export function calculatePeriods(options: PeriodCalculatorOptions): BillingPeriod[] {
  const { 
    contractStartDate, 
    billingCycle, 
    reviewWindowDays,
    upToDate = new Date() 
  } = options;

  const periods: BillingPeriod[] = [];

  switch (billingCycle) {
    case 'monthly':
      return calculateMonthlyPeriods(contractStartDate, reviewWindowDays, upToDate);
    case 'quarterly':
      return calculateQuarterlyPeriods(contractStartDate, reviewWindowDays, upToDate);
    case '28_day':
      return calculate28DayPeriods(contractStartDate, reviewWindowDays, upToDate);
    default:
      return periods;
  }
}

/**
 * Calculate monthly billing periods
 * First period may be partial (from contract start to month end)
 * Subsequent periods are full calendar months
 */
function calculateMonthlyPeriods(
  contractStart: Date, 
  reviewWindowDays: number,
  upToDate: Date
): BillingPeriod[] {
  const periods: BillingPeriod[] = [];
  
  // First period: contract start to end of that month
  let periodStart = contractStart;
  let periodEnd = endOfMonth(contractStart);
  
  while (isBefore(periodStart, upToDate) || isWithinPeriod(upToDate, periodStart, periodEnd)) {
    const reviewDeadline = addDays(periodEnd, reviewWindowDays);
    const status = getPeriodStatus(periodEnd, reviewDeadline, upToDate);
    
    periods.push({
      start_date: periodStart,
      end_date: periodEnd,
      review_deadline: reviewDeadline,
      period_name: format(periodStart, 'MMMM yyyy'),
      status,
    });

    // Move to next month
    periodStart = startOfMonth(addMonths(periodStart, 1));
    periodEnd = endOfMonth(periodStart);
    
    // Safety check: don't generate periods too far into the future
    if (isAfter(periodStart, addMonths(upToDate, 1))) {
      break;
    }
  }

  return periods;
}

/**
 * Calculate quarterly billing periods (Q1, Q2, Q3, Q4)
 */
function calculateQuarterlyPeriods(
  contractStart: Date, 
  reviewWindowDays: number,
  upToDate: Date
): BillingPeriod[] {
  const periods: BillingPeriod[] = [];
  
  // First period: contract start to end of that quarter
  let periodStart = contractStart;
  let periodEnd = endOfQuarter(contractStart);
  
  while (isBefore(periodStart, upToDate) || isWithinPeriod(upToDate, periodStart, periodEnd)) {
    const reviewDeadline = addDays(periodEnd, reviewWindowDays);
    const status = getPeriodStatus(periodEnd, reviewDeadline, upToDate);
    
    // Determine quarter name (Q1, Q2, Q3, Q4)
    const quarter = Math.floor(periodStart.getMonth() / 3) + 1;
    const year = periodStart.getFullYear();
    
    periods.push({
      start_date: periodStart,
      end_date: periodEnd,
      review_deadline: reviewDeadline,
      period_name: `Q${quarter} ${year}`,
      status,
    });

    // Move to next quarter
    periodStart = startOfQuarter(addQuarters(periodStart, 1));
    periodEnd = endOfQuarter(periodStart);
    
    // Safety check
    if (isAfter(periodStart, addQuarters(upToDate, 1))) {
      break;
    }
  }

  return periods;
}

/**
 * Calculate 28-day rolling periods from contract start
 */
function calculate28DayPeriods(
  contractStart: Date, 
  reviewWindowDays: number,
  upToDate: Date
): BillingPeriod[] {
  const periods: BillingPeriod[] = [];
  
  let periodStart = contractStart;
  let periodEnd = addDays(contractStart, 27); // 28 days inclusive
  let cycleNumber = 1;
  
  while (isBefore(periodStart, upToDate) || isWithinPeriod(upToDate, periodStart, periodEnd)) {
    const reviewDeadline = addDays(periodEnd, reviewWindowDays);
    const status = getPeriodStatus(periodEnd, reviewDeadline, upToDate);
    
    periods.push({
      start_date: periodStart,
      end_date: periodEnd,
      review_deadline: reviewDeadline,
      period_name: `Cycle ${cycleNumber}`,
      status,
    });

    // Move to next 28-day period
    periodStart = addDays(periodEnd, 1);
    periodEnd = addDays(periodStart, 27);
    cycleNumber++;
    
    // Safety check
    if (cycleNumber > 100) {
      break;
    }
  }

  return periods;
}

/**
 * Determine the status of a period
 */
function getPeriodStatus(
  periodEnd: Date, 
  reviewDeadline: Date, 
  now: Date
): 'UPCOMING' | 'OPEN' | 'OVERDUE' {
  if (isAfter(periodEnd, now)) {
    return 'UPCOMING'; // Period hasn't ended yet
  }
  
  if (isAfter(reviewDeadline, now)) {
    return 'OPEN'; // Within review window
  }
  
  return 'OVERDUE'; // Past review deadline
}

/**
 * Check if a date is within a period
 */
function isWithinPeriod(date: Date, start: Date, end: Date): boolean {
  return (isAfter(date, start) || date.getTime() === start.getTime()) && 
         (isBefore(date, end) || date.getTime() === end.getTime());
}

/**
 * Get the current active period for a client
 */
export function getCurrentPeriod(options: PeriodCalculatorOptions): BillingPeriod | null {
  const periods = calculatePeriods(options);
  const now = options.upToDate || new Date();
  
  // Find the period that contains today, or the most recent OPEN period
  for (const period of periods.reverse()) {
    if (period.status === 'OPEN' || isWithinPeriod(now, period.start_date, period.end_date)) {
      return period;
    }
  }
  
  return periods[periods.length - 1] ?? null;
}

/**
 * Get periods that need attention (OPEN or OVERDUE)
 */
export function getActionablePeriods(options: PeriodCalculatorOptions): BillingPeriod[] {
  return calculatePeriods(options).filter(
    p => p.status === 'OPEN' || p.status === 'OVERDUE'
  );
}

/**
 * Calculate days remaining until review deadline
 */
export function getDaysUntilDeadline(period: BillingPeriod): number {
  const now = new Date();
  const diff = differenceInDays(period.review_deadline, now);
  return Math.max(0, diff);
}

/**
 * Format a date range for display
 */
export function formatDateRange(start: Date, end: Date): string {
  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
}

