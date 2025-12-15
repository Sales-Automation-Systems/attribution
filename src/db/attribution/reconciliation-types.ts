// Reconciliation System Types

export type BillingModel = 'flat_revshare' | 'plg_sales_split' | 'per_event' | 'hybrid';
export type PeriodType = 'monthly' | 'quarterly' | 'custom';
export type PeriodStatus = 'DRAFT' | 'PENDING_CLIENT' | 'CLIENT_SUBMITTED' | 'UNDER_REVIEW' | 'FINALIZED';
export type LineItemStatus = 'PENDING' | 'SUBMITTED' | 'DISPUTED' | 'CONFIRMED';
export type MotionType = 'PLG' | 'SALES';

export interface ClientBillingConfig {
  id: string;
  client_config_id: string;
  billing_model: BillingModel;
  flat_revshare_rate: number | null;
  plg_revshare_rate: number | null;
  sales_revshare_rate: number | null;
  fee_per_signup: number;
  fee_per_meeting: number;
  default_period_type: PeriodType;
  created_at: Date;
  updated_at: Date;
}

export interface ReconciliationPeriod {
  id: string;
  client_config_id: string;
  period_start: Date;
  period_end: Date;
  period_label: string | null;
  status: PeriodStatus;
  total_revenue_submitted: number;
  total_amount_owed: number;
  total_signups_billed: number;
  total_meetings_billed: number;
  total_paying_customers: number;
  sent_to_client_at: Date | null;
  client_submitted_at: Date | null;
  finalized_at: Date | null;
  finalized_by: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReconciliationLineItem {
  id: string;
  reconciliation_period_id: string;
  attributed_domain_id: string | null;
  domain: string;
  motion_type: MotionType | null;
  has_signup: boolean;
  has_meeting: boolean;
  has_paying_customer: boolean;
  paying_customer_date: Date | null;
  revenue_collected: number | null;
  revenue_notes: string | null;
  calculated_fee: number;
  applied_rate: number | null;
  status: LineItemStatus;
  dispute_reason: string | null;
  dispute_resolved_at: Date | null;
  dispute_resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// Extended types with joins
export interface ReconciliationPeriodWithClient extends ReconciliationPeriod {
  client_name: string;
  client_slug: string;
}

export interface ReconciliationPeriodWithLineItems extends ReconciliationPeriod {
  line_items: ReconciliationLineItem[];
}

// Input types for creating/updating
export interface CreatePeriodInput {
  client_config_id: string;
  period_start: string; // ISO date string
  period_end: string;
  period_label?: string;
}

export interface UpdateLineItemInput {
  revenue_collected?: number;
  revenue_notes?: string;
  status?: LineItemStatus;
  dispute_reason?: string;
}

export interface BillingConfigInput {
  billing_model: BillingModel;
  flat_revshare_rate?: number | null;
  plg_revshare_rate?: number | null;
  sales_revshare_rate?: number | null;
  fee_per_signup?: number;
  fee_per_meeting?: number;
  default_period_type?: PeriodType;
}

// Calculation result types
export interface LineItemCalculation {
  line_item_id: string;
  domain: string;
  motion_type: MotionType | null;
  revenue_collected: number;
  applied_rate: number;
  calculated_fee: number;
  fee_type: 'revshare' | 'signup_fee' | 'meeting_fee';
}

export interface PeriodSummary {
  total_paying_customers: number;
  total_signups: number;
  total_meetings: number;
  total_revenue_submitted: number;
  total_revshare_fees: number;
  total_signup_fees: number;
  total_meeting_fees: number;
  total_amount_owed: number;
}

