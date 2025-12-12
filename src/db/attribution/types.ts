// Attribution Database Types (READ/WRITE)

export interface ClientConfig {
  id: string;
  client_id: string;
  client_name: string;
  slug: string;
  access_uuid: string;
  rev_share_rate: number;
  created_at: Date;
  updated_at: Date;
}

export interface AttributedDomain {
  id: string;
  client_config_id: string;
  domain: string;
  first_email_sent_at: Date | null;
  first_event_at: Date | null;
  first_attributed_month: string | null;
  has_positive_reply: boolean;
  has_sign_up: boolean;
  has_meeting_booked: boolean;
  has_paying_customer: boolean;
  is_within_window: boolean;
  match_type: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH' | null;
  status: 'ATTRIBUTED' | 'DISPUTED' | 'REJECTED' | 'CONFIRMED';
  dispute_reason: string | null;
  dispute_submitted_at: Date | null;
  dispute_resolved_at: Date | null;
  dispute_resolution_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export type EventSource =
  | 'EMAIL_SENT'
  | 'EMAIL_RECEIVED'
  | 'POSITIVE_REPLY'
  | 'SIGN_UP'
  | 'MEETING_BOOKED'
  | 'PAYING_CUSTOMER';

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

