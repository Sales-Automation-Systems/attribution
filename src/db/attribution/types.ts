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
}

// Domain status types
export type DomainStatus =
  | 'ATTRIBUTED'      // Within 31-day window, billable
  | 'OUTSIDE_WINDOW'  // Matched but outside window, not billable unless manually attributed
  | 'UNATTRIBUTED'    // No email match, not billable unless manually attributed
  | 'CLIENT_PROMOTED' // Manually attributed by client, billable (UI shows as "Manually Attributed")
  | 'DISPUTED'        // Client disputed, pending review
  | 'REJECTED'        // Dispute rejected, still billable
  | 'CONFIRMED';      // Manually confirmed attribution

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
  // Dispute fields
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

export type ReconciliationStatus = 'OPEN' | 'SUBMITTED' | 'LOCKED';

export interface ReconciliationPeriod {
  id: string;
  client_config_id: string;
  year: number;
  month: number; // 0 = historical (pre-Dec 2025)
  status: ReconciliationStatus;
  deadline: Date | null;
  net_new_attributed: number;
  net_new_paying: number;
  total_revenue: number;
  rev_share_rate: number | null;
  rev_share_amount: number;
  submitted_at: Date | null;
  locked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReconciliationEntry {
  id: string;
  reconciliation_period_id: string;
  attributed_domain_id: string;
  revenue: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

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

export type TaskType = 'DISPUTE' | 'RECONCILIATION' | 'MANUAL_ATTRIBUTION';
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

