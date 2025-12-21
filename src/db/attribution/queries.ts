// Attribution Database Queries (READ/WRITE)
import { attrQuery, attrPool } from '../index';
import type {
  ClientConfig,
  AttributedDomain,
  DomainEvent,
  AttributionMatch,
  ProcessingJob,
  EventProcessingError,
  SystemLog,
  LogLevel,
  LogSource,
  EventSource,
} from './types';

// ============ Client Config Queries ============

export async function getAllClientConfigs(): Promise<ClientConfig[]> {
  return attrQuery<ClientConfig>(`
    SELECT * FROM client_config ORDER BY client_name
  `);
}

export async function getClientConfigById(id: string): Promise<ClientConfig | null> {
  const rows = await attrQuery<ClientConfig>(
    'SELECT * FROM client_config WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function getClientConfigBySlugAndUuid(
  slug: string,
  accessUuid: string
): Promise<ClientConfig | null> {
  const rows = await attrQuery<ClientConfig>(
    'SELECT * FROM client_config WHERE slug = $1 AND access_uuid = $2',
    [slug, accessUuid]
  );
  return rows[0] || null;
}

export async function getClientConfigByClientId(
  clientId: string
): Promise<ClientConfig | null> {
  const rows = await attrQuery<ClientConfig>(
    'SELECT * FROM client_config WHERE client_id = $1',
    [clientId]
  );
  return rows[0] || null;
}

export async function createClientConfig(data: {
  client_id: string;
  client_name: string;
  slug: string;
  access_uuid?: string;
  rev_share_rate?: number;
}): Promise<ClientConfig> {
  const rows = await attrQuery<ClientConfig>(
    `INSERT INTO client_config (client_id, client_name, slug, access_uuid, rev_share_rate)
     VALUES ($1, $2, $3, COALESCE($4, gen_random_uuid()), COALESCE($5, 0.10))
     RETURNING *`,
    [
      data.client_id,
      data.client_name,
      data.slug,
      data.access_uuid || null,
      data.rev_share_rate || null,
    ]
  );
  return rows[0];
}

export async function updateClientConfig(
  id: string,
  data: Partial<Pick<ClientConfig, 'client_name' | 'slug' | 'rev_share_rate'>>
): Promise<ClientConfig | null> {
  const rows = await attrQuery<ClientConfig>(
    `UPDATE client_config 
     SET client_name = COALESCE($2, client_name),
         slug = COALESCE($3, slug),
         rev_share_rate = COALESCE($4, rev_share_rate),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, data.client_name, data.slug, data.rev_share_rate]
  );
  return rows[0] || null;
}

// ============ Attributed Domain Queries ============

export async function getAttributedDomainsCount(
  clientConfigId: string
): Promise<number> {
  const rows = await attrQuery<{ count: string }>(
    'SELECT COUNT(*) as count FROM attributed_domain WHERE client_config_id = $1',
    [clientConfigId]
  );
  return parseInt(rows[0]?.count || '0', 10);
}

export async function getAttributedDomains(
  clientConfigId: string,
  options?: {
    status?: string | string[];  // Can be single status or array for OR logic
    matchType?: string;
    events?: string[];  // Array of event types: 'reply', 'signup', 'meeting', 'paying'
    search?: string;    // Domain name search
    focusView?: boolean; // Only HARD_MATCH
    limit?: number;
    offset?: number;
  }
): Promise<AttributedDomain[]> {
  let query = 'SELECT * FROM attributed_domain WHERE client_config_id = $1';
  const params: unknown[] = [clientConfigId];
  let paramIndex = 2;

  // Status filter (can be single or array for OR logic)
  if (options?.status) {
    if (Array.isArray(options.status) && options.status.length > 0) {
      // Build OR conditions for multiple statuses
      const statusConditions: string[] = [];
      for (const s of options.status) {
        // Map frontend status names to database conditions
        if (s === 'attributed') {
          statusConditions.push(`(status IN ('ATTRIBUTED', 'MANUAL') AND is_within_window = true AND match_type != 'NO_MATCH')`);
        } else if (s === 'outside_window') {
          statusConditions.push(`(status = 'OUTSIDE_WINDOW' OR (is_within_window = false AND match_type != 'NO_MATCH' AND match_type IS NOT NULL))`);
        } else if (s === 'unattributed') {
          statusConditions.push(`(status = 'UNATTRIBUTED' OR match_type = 'NO_MATCH' OR match_type IS NULL)`);
        } else if (s === 'disputed') {
          statusConditions.push(`status = 'DISPUTED'`);
        } else if (s === 'dispute_pending') {
          statusConditions.push(`status = 'DISPUTE_PENDING'`);
        } else if (s === 'client_attributed') {
          statusConditions.push(`status = 'CLIENT_PROMOTED'`);
        } else {
          // Direct status match
          statusConditions.push(`status = $${paramIndex}`);
          params.push(s);
          paramIndex++;
        }
      }
      if (statusConditions.length > 0) {
        query += ` AND (${statusConditions.join(' OR ')})`;
      }
    } else if (typeof options.status === 'string') {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }
  }

  if (options?.matchType) {
    query += ` AND match_type = $${paramIndex}`;
    params.push(options.matchType);
    paramIndex++;
  }

  // Event type filters (OR logic - has any of these events)
  if (options?.events && options.events.length > 0) {
    const eventConditions: string[] = [];
    if (options.events.includes('reply')) {
      eventConditions.push('has_positive_reply = true');
    }
    if (options.events.includes('signup')) {
      eventConditions.push('has_sign_up = true');
    }
    if (options.events.includes('meeting')) {
      eventConditions.push('has_meeting_booked = true');
    }
    if (options.events.includes('paying')) {
      eventConditions.push('has_paying_customer = true');
    }
    if (eventConditions.length > 0) {
      query += ` AND (${eventConditions.join(' OR ')})`;
    }
  }

  // Search filter
  if (options?.search) {
    query += ` AND domain ILIKE $${paramIndex}`;
    params.push(`%${options.search}%`);
    paramIndex++;
  }

  // Focus view - only hard matches
  if (options?.focusView) {
    query += ` AND match_type = 'HARD_MATCH'`;
  }

  query += ' ORDER BY first_event_at DESC NULLS LAST';

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }

  if (options?.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  return attrQuery<AttributedDomain>(query, params);
}

export async function getAttributedDomainByDomain(
  clientConfigId: string,
  domain: string
): Promise<AttributedDomain | null> {
  const rows = await attrQuery<AttributedDomain>(
    'SELECT * FROM attributed_domain WHERE client_config_id = $1 AND domain = $2',
    [clientConfigId, domain]
  );
  return rows[0] || null;
}

export async function getAttributedDomainById(
  domainId: string
): Promise<AttributedDomain | null> {
  const rows = await attrQuery<AttributedDomain>(
    'SELECT * FROM attributed_domain WHERE id = $1',
    [domainId]
  );
  return rows[0] || null;
}

export async function upsertAttributedDomain(data: {
  client_config_id: string;
  domain: string;
  first_email_sent_at?: Date;
  first_event_at?: Date;
  first_attributed_month?: string;
  has_positive_reply?: boolean;
  has_sign_up?: boolean;
  has_meeting_booked?: boolean;
  has_paying_customer?: boolean;
  is_within_window?: boolean;
  match_type?: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH';
}): Promise<AttributedDomain> {
  const rows = await attrQuery<AttributedDomain>(
    `INSERT INTO attributed_domain (
       client_config_id, domain, first_email_sent_at, first_event_at,
       first_attributed_month, has_positive_reply, has_sign_up, has_meeting_booked,
       has_paying_customer, is_within_window, match_type
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (client_config_id, domain) DO UPDATE SET
       first_email_sent_at = COALESCE(attributed_domain.first_email_sent_at, EXCLUDED.first_email_sent_at),
       first_event_at = COALESCE(attributed_domain.first_event_at, EXCLUDED.first_event_at),
       first_attributed_month = COALESCE(attributed_domain.first_attributed_month, EXCLUDED.first_attributed_month),
       has_positive_reply = attributed_domain.has_positive_reply OR COALESCE(EXCLUDED.has_positive_reply, false),
       has_sign_up = attributed_domain.has_sign_up OR COALESCE(EXCLUDED.has_sign_up, false),
       has_meeting_booked = attributed_domain.has_meeting_booked OR COALESCE(EXCLUDED.has_meeting_booked, false),
       has_paying_customer = attributed_domain.has_paying_customer OR COALESCE(EXCLUDED.has_paying_customer, false),
       is_within_window = attributed_domain.is_within_window OR COALESCE(EXCLUDED.is_within_window, false),
       match_type = COALESCE(EXCLUDED.match_type, attributed_domain.match_type),
       updated_at = NOW()
     RETURNING *`,
    [
      data.client_config_id,
      data.domain,
      data.first_email_sent_at || null,
      data.first_event_at || null,
      data.first_attributed_month || null,
      data.has_positive_reply || false,
      data.has_sign_up || false,
      data.has_meeting_booked || false,
      data.has_paying_customer || false,
      data.is_within_window || false,
      data.match_type || null,
    ]
  );
  return rows[0];
}

export async function submitDispute(
  id: string,
  reason: string
): Promise<AttributedDomain | null> {
  const rows = await attrQuery<AttributedDomain>(
    `UPDATE attributed_domain
     SET status = 'DISPUTED',
         dispute_reason = $2,
         dispute_submitted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, reason]
  );
  return rows[0] || null;
}

export async function resolveDispute(
  id: string,
  resolution: 'REJECTED' | 'CONFIRMED',
  notes: string
): Promise<AttributedDomain | null> {
  const rows = await attrQuery<AttributedDomain>(
    `UPDATE attributed_domain
     SET status = $2,
         dispute_resolved_at = NOW(),
         dispute_resolution_notes = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, resolution, notes]
  );
  return rows[0] || null;
}

// ============ Domain Event Queries ============

export async function getDomainEvents(
  attributedDomainId: string
): Promise<DomainEvent[]> {
  return attrQuery<DomainEvent>(
    `SELECT * FROM domain_event 
     WHERE attributed_domain_id = $1 
     ORDER BY event_time`,
    [attributedDomainId]
  );
}

export async function createDomainEvent(data: {
  attributed_domain_id: string;
  event_source: EventSource;
  event_time: Date;
  email?: string;
  source_id?: string;
  source_table?: string;
  metadata?: Record<string, unknown>;
}): Promise<DomainEvent> {
  const rows = await attrQuery<DomainEvent>(
    `INSERT INTO domain_event (
       attributed_domain_id, event_source, event_time, email,
       source_id, source_table, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.attributed_domain_id,
      data.event_source,
      data.event_time,
      data.email || null,
      data.source_id || null,
      data.source_table || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
  return rows[0];
}

// ============ Attribution Match Queries ============

export async function createAttributionMatch(data: {
  client_config_id: string;
  attribution_event_id: string;
  attributed_domain_id?: string;
  prospect_id?: string;
  event_type: string;
  event_time: Date;
  event_email?: string;
  event_domain?: string;
  match_type: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH';
  matched_email?: string;
  email_sent_at?: Date;
  days_since_email?: number;
  is_within_window?: boolean;
  match_reason?: string;
}): Promise<AttributionMatch> {
  const rows = await attrQuery<AttributionMatch>(
    `INSERT INTO attribution_match (
       client_config_id, attribution_event_id, attributed_domain_id, prospect_id,
       event_type, event_time, event_email, event_domain, match_type,
       matched_email, email_sent_at, days_since_email, is_within_window, match_reason
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (attribution_event_id) DO UPDATE SET
       attributed_domain_id = EXCLUDED.attributed_domain_id,
       match_type = EXCLUDED.match_type,
       matched_email = EXCLUDED.matched_email,
       email_sent_at = EXCLUDED.email_sent_at,
       days_since_email = EXCLUDED.days_since_email,
       is_within_window = EXCLUDED.is_within_window,
       match_reason = EXCLUDED.match_reason
     RETURNING *`,
    [
      data.client_config_id,
      data.attribution_event_id,
      data.attributed_domain_id || null,
      data.prospect_id || null,
      data.event_type,
      data.event_time,
      data.event_email || null,
      data.event_domain || null,
      data.match_type,
      data.matched_email || null,
      data.email_sent_at || null,
      data.days_since_email || null,
      data.is_within_window || false,
      data.match_reason || null,
    ]
  );
  return rows[0];
}

// ============ Processing Job Queries ============

export async function getProcessingJobs(options?: {
  clientConfigId?: string;
  status?: string;
  limit?: number;
}): Promise<ProcessingJob[]> {
  let query = 'SELECT * FROM processing_job WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.clientConfigId) {
    query += ` AND client_config_id = $${paramIndex}`;
    params.push(options.clientConfigId);
    paramIndex++;
  }

  if (options?.status) {
    query += ` AND status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  query += ' ORDER BY created_at DESC';

  if (options?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  return attrQuery<ProcessingJob>(query, params);
}

export async function getOrCreateProcessingJob(
  clientConfigId: string,
  jobType: 'FULL_PROCESS' | 'INCREMENTAL' | 'SINGLE_CLIENT' = 'SINGLE_CLIENT'
): Promise<ProcessingJob> {
  // Check for existing running job
  const existing = await attrQuery<ProcessingJob>(
    `SELECT * FROM processing_job 
     WHERE client_config_id = $1 AND status IN ('PENDING', 'RUNNING')
     ORDER BY created_at DESC LIMIT 1`,
    [clientConfigId]
  );

  if (existing[0]) {
    return existing[0];
  }

  // Create new job
  const rows = await attrQuery<ProcessingJob>(
    `INSERT INTO processing_job (client_config_id, job_type, status)
     VALUES ($1, $2, 'PENDING')
     RETURNING *`,
    [clientConfigId, jobType]
  );
  return rows[0];
}

export async function startProcessingJob(
  id: string,
  totalEvents: number
): Promise<ProcessingJob | null> {
  const rows = await attrQuery<ProcessingJob>(
    `UPDATE processing_job
     SET status = 'RUNNING',
         total_events = $2,
         started_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, totalEvents]
  );
  return rows[0] || null;
}

export async function updateProcessingJobProgress(
  id: string,
  progress: {
    processed_events: number;
    matched_hard: number;
    matched_soft: number;
    no_match: number;
    last_processed_event_id: string;
    current_batch: number;
  }
): Promise<ProcessingJob | null> {
  const rows = await attrQuery<ProcessingJob>(
    `UPDATE processing_job
     SET processed_events = $2,
         matched_hard = $3,
         matched_soft = $4,
         no_match = $5,
         last_processed_event_id = $6,
         current_batch = $7,
         last_checkpoint_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      progress.processed_events,
      progress.matched_hard,
      progress.matched_soft,
      progress.no_match,
      progress.last_processed_event_id,
      progress.current_batch,
    ]
  );
  return rows[0] || null;
}

export async function completeProcessingJob(id: string): Promise<ProcessingJob | null> {
  const rows = await attrQuery<ProcessingJob>(
    `UPDATE processing_job
     SET status = 'COMPLETED',
         completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

export async function failProcessingJob(
  id: string,
  errorMessage: string
): Promise<ProcessingJob | null> {
  const rows = await attrQuery<ProcessingJob>(
    `UPDATE processing_job
     SET status = 'FAILED',
         error_message = $2,
         completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, errorMessage]
  );
  return rows[0] || null;
}

// ============ Event Processing Error Queries ============

export async function logEventError(data: {
  processing_job_id: string;
  attribution_event_id: string;
  error_message: string;
  error_stack?: string;
}): Promise<EventProcessingError> {
  const rows = await attrQuery<EventProcessingError>(
    `INSERT INTO event_processing_error (
       processing_job_id, attribution_event_id, error_message, error_stack
     )
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.processing_job_id,
      data.attribution_event_id,
      data.error_message,
      data.error_stack || null,
    ]
  );
  return rows[0];
}

// ============ Personal Email Domain Queries ============

export async function isPersonalEmailDomain(domain: string): Promise<boolean> {
  const rows = await attrQuery<{ domain: string }>(
    'SELECT domain FROM personal_email_domain WHERE domain = $1',
    [domain.toLowerCase()]
  );
  return rows.length > 0;
}

export async function getAllPersonalEmailDomains(): Promise<string[]> {
  const rows = await attrQuery<{ domain: string }>(
    'SELECT domain FROM personal_email_domain ORDER BY domain'
  );
  return rows.map((r) => r.domain);
}

// ============ System Log Queries ============

export async function logToDb(data: {
  level: LogLevel;
  source: LogSource;
  message: string;
  context?: Record<string, unknown>;
  client_config_id?: string;
  processing_job_id?: string;
}): Promise<SystemLog> {
  const rows = await attrQuery<SystemLog>(
    `INSERT INTO system_log (
       level, source, message, context, client_config_id, processing_job_id
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.level,
      data.source,
      data.message,
      data.context ? JSON.stringify(data.context) : null,
      data.client_config_id || null,
      data.processing_job_id || null,
    ]
  );
  return rows[0];
}

export async function getRecentLogs(options?: {
  level?: LogLevel;
  source?: LogSource;
  limit?: number;
}): Promise<SystemLog[]> {
  let query = 'SELECT * FROM system_log WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.level) {
    query += ` AND level = $${paramIndex}`;
    params.push(options.level);
    paramIndex++;
  }

  if (options?.source) {
    query += ` AND source = $${paramIndex}`;
    params.push(options.source);
    paramIndex++;
  }

  query += ' ORDER BY created_at DESC';
  query += ` LIMIT $${paramIndex}`;
  params.push(options?.limit || 50);

  return attrQuery<SystemLog>(query, params);
}

// ============ Worker Heartbeat Queries ============

export async function updateWorkerHeartbeat(
  status: 'running' | 'idle' | 'processing',
  currentJobId?: string
): Promise<void> {
  await attrPool.query(
    `INSERT INTO worker_heartbeat (id, last_heartbeat, status, current_job_id)
     VALUES ('main', NOW(), $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       last_heartbeat = NOW(),
       status = $1,
       current_job_id = $2`,
    [status, currentJobId || null]
  );
}

export async function getWorkerHeartbeat(): Promise<{
  last_heartbeat: Date;
  status: string;
  current_job_id: string | null;
  is_healthy: boolean;
} | null> {
  const rows = await attrQuery<{
    last_heartbeat: Date;
    status: string;
    current_job_id: string | null;
  }>('SELECT * FROM worker_heartbeat WHERE id = $1', ['main']);

  if (!rows[0]) return null;

  const lastBeat = new Date(rows[0].last_heartbeat);
  const isHealthy = Date.now() - lastBeat.getTime() < 60000; // 1 minute

  return {
    ...rows[0],
    is_healthy: isHealthy,
  };
}

// ============ Dashboard Stats Queries ============

export async function getDashboardStats(clientConfigId?: string): Promise<{
  total_attributed_domains: number;
  total_paying_customers: number;
  total_hard_matches: number;
  total_soft_matches: number;
  pending_disputes: number;
}> {
  let query = `
    SELECT 
      COUNT(*) FILTER (WHERE is_within_window = true) as total_attributed_domains,
      COUNT(*) FILTER (WHERE has_paying_customer = true) as total_paying_customers,
      COUNT(*) FILTER (WHERE match_type = 'HARD_MATCH') as total_hard_matches,
      COUNT(*) FILTER (WHERE match_type = 'SOFT_MATCH') as total_soft_matches,
      COUNT(*) FILTER (WHERE status = 'DISPUTED') as pending_disputes
    FROM attributed_domain
  `;

  const params: unknown[] = [];
  if (clientConfigId) {
    query += ' WHERE client_config_id = $1';
    params.push(clientConfigId);
  }

  const rows = await attrQuery<{
    total_attributed_domains: string;
    total_paying_customers: string;
    total_hard_matches: string;
    total_soft_matches: string;
    pending_disputes: string;
  }>(query, params);

  return {
    total_attributed_domains: parseInt(rows[0]?.total_attributed_domains || '0', 10),
    total_paying_customers: parseInt(rows[0]?.total_paying_customers || '0', 10),
    total_hard_matches: parseInt(rows[0]?.total_hard_matches || '0', 10),
    total_soft_matches: parseInt(rows[0]?.total_soft_matches || '0', 10),
    pending_disputes: parseInt(rows[0]?.pending_disputes || '0', 10),
  };
}

export interface ClientStats {
  total_emails_sent: number;
  total_positive_replies: number;
  total_sign_ups: number;
  total_meetings_booked: number;
  total_paying_customers: number;
  attributed_positive_replies: number;
  attributed_sign_ups: number;
  attributed_meetings_booked: number;
  attributed_paying_customers: number;
  last_processed_at: Date | null;
}

export async function getClientStats(clientConfigId: string): Promise<ClientStats> {
  const rows = await attrQuery<{
    total_emails_sent: string;
    total_positive_replies: string;
    total_sign_ups: string;
    total_meetings_booked: string;
    total_paying_customers: string;
    attributed_positive_replies: string;
    attributed_sign_ups: string;
    attributed_meetings_booked: string;
    attributed_paying_customers: string;
    last_processed_at: Date | null;
  }>(`
    SELECT 
      COALESCE(total_emails_sent, 0) as total_emails_sent,
      COALESCE(total_positive_replies, 0) as total_positive_replies,
      COALESCE(total_sign_ups, 0) as total_sign_ups,
      COALESCE(total_meetings_booked, 0) as total_meetings_booked,
      COALESCE(total_paying_customers, 0) as total_paying_customers,
      COALESCE(attributed_positive_replies, 0) as attributed_positive_replies,
      COALESCE(attributed_sign_ups, 0) as attributed_sign_ups,
      COALESCE(attributed_meetings_booked, 0) as attributed_meetings_booked,
      COALESCE(attributed_paying_customers, 0) as attributed_paying_customers,
      last_processed_at
    FROM client_config
    WHERE id = $1
  `, [clientConfigId]);

  if (rows.length === 0) {
    return {
      total_emails_sent: 0,
      total_positive_replies: 0,
      total_sign_ups: 0,
      total_meetings_booked: 0,
      total_paying_customers: 0,
      attributed_positive_replies: 0,
      attributed_sign_ups: 0,
      attributed_meetings_booked: 0,
      attributed_paying_customers: 0,
      last_processed_at: null,
    };
  }

  return {
    total_emails_sent: parseInt(rows[0].total_emails_sent, 10),
    total_positive_replies: parseInt(rows[0].total_positive_replies, 10),
    total_sign_ups: parseInt(rows[0].total_sign_ups, 10),
    total_meetings_booked: parseInt(rows[0].total_meetings_booked, 10),
    total_paying_customers: parseInt(rows[0].total_paying_customers, 10),
    attributed_positive_replies: parseInt(rows[0].attributed_positive_replies, 10),
    attributed_sign_ups: parseInt(rows[0].attributed_sign_ups, 10),
    attributed_meetings_booked: parseInt(rows[0].attributed_meetings_booked, 10),
    attributed_paying_customers: parseInt(rows[0].attributed_paying_customers, 10),
    last_processed_at: rows[0].last_processed_at,
  };
}

// ============ Status Change Logging ============

export type StatusChangeAction = 
  | 'DISPUTE_SUBMITTED'
  | 'DISPUTE_APPROVED'
  | 'DISPUTE_REJECTED'
  | 'MANUAL_ATTRIBUTION'
  | 'STATUS_UPDATE'
  | 'SYSTEM_UPDATE';

export interface StatusChangeMetadata {
  oldStatus: string;
  newStatus: string;
  action: StatusChangeAction;
  reason?: string;
  changedBy?: string;
}

/**
 * Log a status change event to the domain_event table.
 * This creates a full audit trail of all status changes on a domain.
 */
export async function logStatusChange(
  attributedDomainId: string,
  metadata: StatusChangeMetadata
): Promise<DomainEvent> {
  const rows = await attrQuery<DomainEvent>(`
    INSERT INTO domain_event (
      attributed_domain_id,
      event_source,
      event_time,
      metadata
    ) VALUES ($1, 'STATUS_CHANGE', NOW(), $2)
    RETURNING *
  `, [
    attributedDomainId,
    JSON.stringify(metadata),
  ]);
  return rows[0];
}

