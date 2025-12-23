// Attribution Database Types (READ/WRITE)

export type AttributionMode = 'per_event' | 'per_domain';

export interface ClientConfig {
  id: string;
  client_id: string;
  client_name: string;
  slug: string;
  access_uuid: string;
  rev_share_rate: number;
  // Attribution settings
  sign_ups_mode: AttributionMode;
  meetings_mode: AttributionMode;
  paying_mode: AttributionMode;
  attribution_window_days: number;
  soft_match_enabled: boolean;
  exclude_personal_domains: boolean;
  // Top-level totals
  total_emails_sent: number;
  total_positive_replies: number;
  total_sign_ups: number;
  total_meetings_booked: number;
  total_paying_customers: number;
  // Attributed totals
  attributed_positive_replies: number;
  attributed_sign_ups: number;
  attributed_meetings_booked: number;
  attributed_paying_customers: number;
  // Hard match breakdown per event type
  hard_match_positive_replies: number;
  hard_match_sign_ups: number;
  hard_match_meetings: number;
  hard_match_paying: number;
  // Soft match breakdown per event type
  soft_match_positive_replies: number;
  soft_match_sign_ups: number;
  soft_match_meetings: number;
  soft_match_paying: number;
  // Not matched counts
  not_matched_sign_ups: number;
  not_matched_meetings: number;
  not_matched_paying: number;
  // Outside window counts (emailed, but event > 31 days after)
  outside_window_sign_ups: number;
  outside_window_meetings: number;
  outside_window_paying: number;
  // Domain breakdown counts
  domains_with_replies: number;
  domains_with_signups: number;
  domains_with_meetings: number;
  domains_with_paying: number;
  domains_with_multiple_events: number;
  // Processing
  last_processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Billing model fields
  billing_model: 'flat_revshare' | 'plg_sales_split';
  revshare_plg: number | null;
  revshare_sales: number | null;
  fee_per_signup: number | null;
  fee_per_meeting: number | null;
  reconciliation_interval: 'monthly' | 'quarterly' | 'custom';
  // Auto-reconciliation fields
  contract_start_date: Date | null;
  billing_cycle: 'monthly' | 'quarterly' | '28_day';
  estimated_acv: number;
  review_window_days: number;
  // Custom event fields
  custom_event_name: string | null;
  fee_per_custom_event: number | null;
}

// Domain status types
export type DomainStatus =
  | 'ATTRIBUTED'              // Within 31-day window, billable
  | 'OUTSIDE_WINDOW'          // Matched but outside window, not billable unless manually attributed
  | 'UNATTRIBUTED'            // No email match, not billable unless manually attributed
  | 'CLIENT_PROMOTED'         // Manually attributed by client, billable (UI shows as "Manually Attributed")
  | 'PENDING_CLIENT_REVIEW'   // Agency sent for client review, awaiting response
  | 'CLIENT_REJECTED'         // Client rejected attribution, not billable
  | 'CONFIRMED'               // Manually confirmed attribution
  // Legacy statuses (for backward compatibility with existing data)
  | 'DISPUTE_PENDING'         // [DEPRECATED] Use PENDING_CLIENT_REVIEW
  | 'DISPUTED'                // [DEPRECATED] Use CLIENT_REJECTED
  | 'REJECTED';               // [DEPRECATED] Old dispute rejection status

// Match type including manual entries
export type MatchType = 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH' | 'MANUAL' | null;

export interface AttributedDomain {
  id: string;
  client_config_id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  last_event_at: Date | null;
  first_attributed_month: string | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: MatchType;
  status: DomainStatus;
  // Focused contact(s) - emails that had success events (hard match)
  matched_email: string | null; // Legacy single email (deprecated)
  matched_emails: string[] | null; // Array of all hard-matched emails
  // Review fields (agency-initiated client review workflow)
  review_sent_at: Date | null;
  review_sent_by: string | null;
  review_responded_at: Date | null;
  review_response: 'CONFIRMED' | 'REJECTED' | null;
  review_response_by: string | null;
  review_notes: string | null;
  // Legacy dispute fields (kept for backward compatibility)
  dispute_reason: string | null;
  dispute_submitted_at: Date | null;
  dispute_resolved_at: Date | null;
  dispute_resolution_notes: string | null;
  // Manual attribution fields (for CLIENT_PROMOTED status - UI shows as "Manually Attributed")
  // Note: DB columns remain as promoted_* for backward compatibility
  promoted_at: Date | null;
  promoted_by: string | null;
  promotion_notes: string | null;
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export type EventSource =
  | 'EMAIL_SENT'
  | 'EMAIL_RECEIVED'
  | 'POSITIVE_REPLY'
  | 'SIGN_UP'
  | 'MEETING_BOOKED'
  | 'PAYING_CUSTOMER'
  | 'STATUS_CHANGE';

export interface DomainEvent {
  id: string;
  attributed_domain_id: string;
  event_source: EventSource;
  event_time: Date;
  email: string | null;
  source_id: string | null;
  source_table: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface AttributionMatch {
  id: string;
  client_config_id: string;
  attribution_event_id: string;
  attributed_domain_id: string | null;
  prospect_id: string | null;
  event_type: string;
  event_time: Date;
  event_email: string | null;
  event_domain: string | null;
  match_type: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH';
  matched_email: string | null;
  email_sent_at: Date | null;
  days_since_email: number | null;
  is_within_window: boolean;
  match_reason: string | null;
  created_at: Date;
}

// Old reconciliation types removed - see new system below

export type ProcessingJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ProcessingJobType = 'FULL_PROCESS' | 'INCREMENTAL' | 'SINGLE_CLIENT';

export interface ProcessingJob {
  id: string;
  client_config_id: string | null;
  job_type: ProcessingJobType;
  status: ProcessingJobStatus;
  total_events: number;
  processed_events: number;
  matched_hard: number;
  matched_soft: number;
  no_match: number;
  last_processed_event_id: string | null;
  last_checkpoint_at: Date | null;
  batch_size: number;
  current_batch: number;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

export interface EventProcessingError {
  id: string;
  processing_job_id: string | null;
  attribution_event_id: string | null;
  error_message: string | null;
  error_stack: string | null;
  created_at: Date;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogSource = 'worker' | 'api' | 'cron' | 'ui';

export interface SystemLog {
  id: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  context: Record<string, unknown> | null;
  client_config_id: string | null;
  processing_job_id: string | null;
  created_at: Date;
}

export interface WorkerHeartbeat {
  id: string;
  last_heartbeat: Date;
  status: 'running' | 'idle' | 'processing';
  current_job_id: string | null;
  metadata: Record<string, unknown> | null;
}

// ============ Task/Dispute System ============

export type TaskType = 'REVIEW' | 'DISPUTE' | 'RECONCILIATION' | 'MANUAL_ATTRIBUTION';
export type TaskStatus = 'OPEN' | 'PENDING_INFO' | 'APPROVED' | 'REJECTED';
export type TaskAuthorType = 'CLIENT' | 'AGENCY';

export interface Task {
  id: string;
  client_config_id: string;
  attributed_domain_id: string | null;
  type: TaskType;
  status: TaskStatus;
  title: string | null;
  description: string | null;
  submitted_by: string | null;
  submitted_at: Date;
  resolved_by: string | null;
  resolved_at: Date | null;
  resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_type: TaskAuthorType;
  author_name: string | null;
  content: string;
  created_at: Date;
}

// Extended task with related data for UI
export interface TaskWithDetails extends Task {
  client_name?: string;
  domain?: string;
  comment_count?: number;
}

// ============ Reconciliation System ============

export type ReconciliationStatus = 
  | 'UPCOMING'        // Period hasn't ended yet, not ready for reconciliation
  | 'OPEN'            // Period ended, awaiting client submission
  | 'PENDING_CLIENT'  // Sent to client for revenue submission (legacy)
  | 'CLIENT_SUBMITTED' // Client has submitted revenue data
  | 'UNDER_REVIEW'    // Agency is reviewing submitted data
  | 'AUTO_BILLED'     // Client missed deadline, auto-billed using estimates
  | 'FINALIZED';      // Reconciliation complete

export type ReconciliationLineStatus = 
  | 'PENDING'    // Awaiting revenue submission
  | 'SUBMITTED'  // Revenue has been entered
  | 'DISPUTED'   // Client or agency disputed this line
  | 'CONFIRMED'; // Both parties agree on the amount

export type MotionType = 'PLG' | 'SALES';

export interface ReconciliationPeriod {
  id: string;
  client_config_id: string;
  period_name: string;
  start_date: Date;
  end_date: Date;
  status: ReconciliationStatus;
  created_by: string | null;
  created_at: Date;
  sent_to_client_at: Date | null;
  client_submitted_at: Date | null;
  finalized_at: Date | null;
  finalized_by: string | null;
  total_signups: number;
  total_meetings: number;
  total_paying_customers: number;
  total_revenue_submitted: number;
  total_amount_owed: number;
  agency_notes: string | null;
  client_notes: string | null;
  updated_at: Date;
  // Auto-reconciliation fields
  auto_generated: boolean;
  review_deadline: Date | null;
  auto_billed_at: Date | null;
  estimated_total: number | null;
}

export interface ReconciliationLineItem {
  id: string;
  reconciliation_period_id: string;
  attributed_domain_id: string | null;
  domain: string;
  motion_type: MotionType | null;
  signup_count: number;
  meeting_count: number;
  // Monthly revenue breakdown (for quarterly clients)
  revenue_month_1: number | null;
  revenue_month_2: number | null;
  revenue_month_3: number | null;
  // Legacy single revenue field (sum of monthly)
  revenue_submitted: number | null;
  revenue_submitted_at: Date | null;
  revenue_notes: string | null;
  // Date customer became paying
  paying_customer_date: Date | null;
  revshare_rate_applied: number | null;
  signup_fee_applied: number | null;
  meeting_fee_applied: number | null;
  amount_owed: number | null;
  status: ReconciliationLineStatus;
  dispute_reason: string | null;
  dispute_submitted_at: Date | null;
  resolution_notes: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Extended types for UI
export interface ReconciliationPeriodWithClient extends ReconciliationPeriod {
  client_name?: string;
  client_slug?: string;
}

export interface ReconciliationLineItemWithDomain extends ReconciliationLineItem {
  has_meeting_booked?: boolean;
  first_event_at?: Date | null;
  last_event_at?: Date | null;
}

