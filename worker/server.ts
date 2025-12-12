// Railway Background Worker with HTTP API
// Processes attribution jobs asynchronously with BATCHED queries

import express from 'express';
import { Pool } from 'pg';

// Initialize pools
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
});

const attrPool = new Pool({
  connectionString: process.env.ATTR_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
});

// ============ Job State ============
interface JobState {
  id: string;
  type: 'sync' | 'process-client' | 'process-all';
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  progress?: {
    current: number;
    total: number;
    currentClient?: string;
  };
  result?: unknown;
  error?: string;
}

const activeJobs = new Map<string, JobState>();
let jobCounter = 0;

function createJob(type: JobState['type']): JobState {
  const job: JobState = {
    id: `job_${Date.now()}_${++jobCounter}`,
    type,
    status: 'running',
    startedAt: new Date(),
  };
  activeJobs.set(job.id, job);
  return job;
}

// ============ Domain Utils ============
const MULTI_PART_TLDS = new Set([
  'co.uk', 'co.nz', 'co.za', 'co.jp', 'co.kr', 'co.in',
  'com.au', 'com.br', 'com.mx', 'com.sg', 'com.hk',
  'org.uk', 'org.au', 'net.au', 'gov.uk', 'ac.uk',
]);

function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;
  let d = domain.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
  d = d.replace(/^www\./, '');
  const parts = d.split('.');
  if (parts.length < 2) return d;
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) {
      return parts.slice(-3).join('.');
    }
  }
  return parts.slice(-2).join('.');
}

function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  return normalizeDomain(parts[1]);
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ============ Database Helpers ============
async function prodQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await prodPool.query(sql, params);
  return result.rows as T[];
}

async function attrQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await attrPool.query(sql, params);
  return result.rows as T[];
}

// ============ Valid OP Status Values ============
const VALID_OP_STATUSES = [
  '1 - Onboarding In Progress',
  '2 - Onboarded',
  '3 - Testimonial Done',
];

// Clients to ALWAYS include regardless of op_status (for testing/auditing)
const ALWAYS_INCLUDE_CLIENTS = new Set([
  'Datacy',
]);

// ============ Sync Logic ============
async function syncClientsFromProduction(): Promise<string[]> {
  console.log('Syncing clients from production...');
  console.log(`Only syncing clients with op_status: ${VALID_OP_STATUSES.join(', ')}`);
  console.log(`Exception clients (always included): ${Array.from(ALWAYS_INCLUDE_CLIENTS).join(', ')}`);
  
  // Get clients with valid op_status OR in the exception list
  const productionClients = await prodQuery<{ id: string; client_name: string; op_status: string }>(`
    SELECT id, client_name, op_status
    FROM client
    WHERE is_active = true 
      AND is_deleted = false
      AND (op_status = ANY($1) OR client_name = ANY($2))
    ORDER BY client_name
  `, [VALID_OP_STATUSES, Array.from(ALWAYS_INCLUDE_CLIENTS)]);
  
  console.log(`Found ${productionClients.length} eligible clients in production`);
  
  const existingConfigs = await attrQuery<{ client_id: string }>(`
    SELECT client_id FROM client_config
  `);
  const existingIds = new Set(existingConfigs.map(c => c.client_id));
  
  const newClients: string[] = [];
  
  for (const client of productionClients) {
    if (!existingIds.has(client.id)) {
      await attrQuery(`
        INSERT INTO client_config (client_id, client_name, slug, access_uuid, rev_share_rate)
        VALUES ($1, $2, $3, gen_random_uuid(), 0.10)
      `, [client.id, client.client_name, slugify(client.client_name)]);
      
      newClients.push(client.client_name);
      console.log(`Created config for: ${client.client_name} (${client.op_status})`);
    }
  }
  
  console.log(`Sync complete. ${newClients.length} new clients added.`);
  return newClients;
}

// ============ Processing Logic (BATCHED) ============
interface ProcessingStats {
  // Event counts
  totalSignUps: number;
  totalMeetings: number;
  totalPaying: number;
  totalPositiveReplies: number;
  // Attribution counts (within 31-day window)
  attributedSignUps: number;
  attributedMeetings: number;
  attributedPaying: number;
  attributedPositiveReplies: number;
  // Hard match breakdown per event type (within window)
  hardMatchPositiveReplies: number;
  hardMatchSignUps: number;
  hardMatchMeetings: number;
  hardMatchPaying: number;
  // Soft match breakdown per event type (within window)
  softMatchPositiveReplies: number;
  softMatchSignUps: number;
  softMatchMeetings: number;
  softMatchPaying: number;
  // Outside window counts (emailed, but event > 31 days after)
  outsideWindowSignUps: number;
  outsideWindowMeetings: number;
  outsideWindowPaying: number;
  // Not matched counts (never emailed this person/domain)
  notMatchedSignUps: number;
  notMatchedMeetings: number;
  notMatchedPaying: number;
  // Domain counts
  totalDomains: number;
  domainsWithReplies: number;
  domainsWithSignups: number;
  domainsWithMeetings: number;
  domainsWithPaying: number;
  domainsWithMultipleEvents: number;
  // Top-level stats
  totalEmailsSent: number;
  // Processing
  errors: number;
}

interface DomainResult {
  domain: string;
  firstEmailSent: Date | null;
  firstEvent: Date | null;
  isWithinWindow: boolean;
  matchType: 'HARD_MATCH' | 'SOFT_MATCH';
  hasSignUp: boolean;
  hasMeetingBooked: boolean;
  hasPayingCustomer: boolean;
  hasPositiveReply: boolean;
}

interface ClientSettings {
  id: string;
  client_name: string;
  sign_ups_mode: 'per_event' | 'per_domain';
  meetings_mode: 'per_event' | 'per_domain';
  paying_mode: 'per_event' | 'per_domain';
  attribution_window_days: number;
  soft_match_enabled: boolean;
  exclude_personal_domains: boolean;
}

async function processClient(clientId: string): Promise<ProcessingStats> {
  console.log(`Processing client: ${clientId}`);
  
  const configs = await attrQuery<ClientSettings>(`
    SELECT id, client_name, sign_ups_mode, meetings_mode, paying_mode,
           attribution_window_days, soft_match_enabled, exclude_personal_domains
    FROM client_config WHERE client_id = $1
  `, [clientId]);
  
  if (configs.length === 0) {
    throw new Error(`Client config not found for: ${clientId}`);
  }
  
  const clientConfig = configs[0];
  const settings = {
    signUpsMode: clientConfig.sign_ups_mode || 'per_event',
    meetingsMode: clientConfig.meetings_mode || 'per_event',
    payingMode: clientConfig.paying_mode || 'per_domain',
    windowDays: clientConfig.attribution_window_days ?? 31,
    softMatchEnabled: clientConfig.soft_match_enabled ?? true,
    excludePersonalDomains: clientConfig.exclude_personal_domains ?? true,
  };
  
  console.log(`Processing: ${clientConfig.client_name}`);
  console.log(`  Settings: window=${settings.windowDays}d, signUps=${settings.signUpsMode}, meetings=${settings.meetingsMode}, paying=${settings.payingMode}`);
  
  const stats: ProcessingStats = {
    totalSignUps: 0,
    totalMeetings: 0,
    totalPaying: 0,
    totalPositiveReplies: 0,
    attributedSignUps: 0,
    attributedMeetings: 0,
    attributedPaying: 0,
    attributedPositiveReplies: 0,
    hardMatchPositiveReplies: 0,
    hardMatchSignUps: 0,
    hardMatchMeetings: 0,
    hardMatchPaying: 0,
    softMatchPositiveReplies: 0,
    softMatchSignUps: 0,
    softMatchMeetings: 0,
    softMatchPaying: 0,
    outsideWindowSignUps: 0,
    outsideWindowMeetings: 0,
    outsideWindowPaying: 0,
    notMatchedSignUps: 0,
    notMatchedMeetings: 0,
    notMatchedPaying: 0,
    totalDomains: 0,
    domainsWithReplies: 0,
    domainsWithSignups: 0,
    domainsWithMeetings: 0,
    domainsWithPaying: 0,
    domainsWithMultipleEvents: 0,
    totalEmailsSent: 0,
    errors: 0,
  };
  
  // ============ PHASE 1: Get top-level stats ============
  console.log('Fetching top-level stats...');
  
  // Count total emails sent
  const emailCountResult = await prodQuery<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM email_conversation ec
    JOIN client_integration ci ON ec.client_integration_id = ci.id
    WHERE ec.type = 'Sent' AND ci.client_id = $1
  `, [clientId]);
  stats.totalEmailsSent = parseInt(emailCountResult[0]?.count || '0', 10);
  console.log(`  Total emails sent: ${stats.totalEmailsSent}`);
  
  // ============ PHASE 2: Fetch attribution events ============
  console.log('Fetching attribution events...');
  const events = await prodQuery<{
    id: string;
    event_type: string;
    email: string | null;
    domain: string | null;
    event_time: Date;
  }>(`
    SELECT ae.id, ae.event_type, ae.email, ae.domain, ae.event_time
    FROM attribution_event ae
    JOIN client_integration ci ON ae.client_integration_id = ci.id
    WHERE ci.client_id = $1
      AND ae.event_type IN ('sign_up', 'meeting_booked', 'paying_customer')
    ORDER BY ae.event_time
  `, [clientId]);
  
  // Count by type
  for (const e of events) {
    if (e.event_type === 'sign_up') stats.totalSignUps++;
    else if (e.event_type === 'meeting_booked') stats.totalMeetings++;
    else if (e.event_type === 'paying_customer') stats.totalPaying++;
  }
  console.log(`  Sign-ups: ${stats.totalSignUps}, Meetings: ${stats.totalMeetings}, Paying: ${stats.totalPaying}`);
  
  // ============ PHASE 3: Fetch positive replies ============
  console.log('Fetching positive replies...');
  const positiveReplies = await prodQuery<{
    id: string;
    lead_email: string;
    company_domain: string | null;
    last_interaction_time: Date | null;
    category_name: string;
  }>(`
    SELECT p.id, p.lead_email, p.company_domain, p.last_interaction_time,
           lc.name as category_name
    FROM prospect p
    JOIN lead_category lc ON p.lead_category_id = lc.id
    JOIN client_integration ci ON p.client_integration_id = ci.id
    WHERE lc.sentiment = 'POSITIVE'
      AND ci.client_id = $1
  `, [clientId]);
  
  stats.totalPositiveReplies = positiveReplies.length;
  console.log(`  Positive replies: ${stats.totalPositiveReplies}`);
  
  // ============ PHASE 4: Build email/domain send time maps ============
  // Collect all emails and domains we need to look up
  const emails = new Set<string>();
  const domains = new Set<string>();
  
  for (const event of events) {
    const email = event.email?.toLowerCase();
    const domain = normalizeDomain(event.domain ?? extractDomain(event.email));
    if (email) emails.add(email);
    if (domain) domains.add(domain);
  }
  
  // Positive replies: always attributed (we emailed them, they replied)
  // But we still need domains for consolidation
  for (const pr of positiveReplies) {
    const email = pr.lead_email?.toLowerCase();
    const domain = normalizeDomain(pr.company_domain ?? extractDomain(pr.lead_email));
    if (email) emails.add(email);
    if (domain) domains.add(domain);
  }
  
  console.log(`Unique emails: ${emails.size}, unique domains: ${domains.size}`);
  
  // BATCH LOOKUP: Query send times in chunks
  console.log('Fetching email send times (chunked)...');
  const emailSendTimes = new Map<string, Date>();
  const domainSendTimes = new Map<string, Date>();
  const CHUNK_SIZE = 100;
  
  const emailArray = Array.from(emails);
  for (let i = 0; i < emailArray.length; i += CHUNK_SIZE) {
    const chunk = emailArray.slice(i, i + CHUNK_SIZE);
    if (i % 500 === 0 && emailArray.length > 500) {
      console.log(`  Checking emails ${i + 1}-${Math.min(i + CHUNK_SIZE, emailArray.length)}/${emailArray.length}`);
    }
    
    const results = await prodQuery<{ email: string; min_sent: Date }>(`
      SELECT LOWER(p.lead_email) as email, MIN(ec.timestamp_email) as min_sent
      FROM email_conversation ec
      JOIN prospect p ON ec.prospect_id = p.id
      JOIN client_integration ci ON ec.client_integration_id = ci.id
      WHERE ec.type = 'Sent'
        AND ci.client_id = $1
        AND LOWER(p.lead_email) = ANY($2)
      GROUP BY LOWER(p.lead_email)
    `, [clientId, chunk]);
    
    for (const row of results) {
      emailSendTimes.set(row.email, row.min_sent);
    }
  }
  console.log(`  Found ${emailSendTimes.size} emails with send history`);
  
  const domainArray = Array.from(domains);
  for (let i = 0; i < domainArray.length; i += CHUNK_SIZE) {
    const chunk = domainArray.slice(i, i + CHUNK_SIZE);
    if (i % 500 === 0 && domainArray.length > 500) {
      console.log(`  Checking domains ${i + 1}-${Math.min(i + CHUNK_SIZE, domainArray.length)}/${domainArray.length}`);
    }
    
    const results = await prodQuery<{ domain: string; min_sent: Date }>(`
      SELECT LOWER(p.company_domain) as domain, MIN(ec.timestamp_email) as min_sent
      FROM email_conversation ec
      JOIN prospect p ON ec.prospect_id = p.id
      JOIN client_integration ci ON ec.client_integration_id = ci.id
      WHERE ec.type = 'Sent'
        AND ci.client_id = $1
        AND LOWER(p.company_domain) = ANY($2)
      GROUP BY LOWER(p.company_domain)
    `, [clientId, chunk]);
    
    for (const row of results) {
      domainSendTimes.set(row.domain, row.min_sent);
    }
  }
  console.log(`  Found ${domainSendTimes.size} domains with send history`);
  
  // ============ PHASE 5: Process attribution events ============
  console.log('Processing attribution events...');
  const domainResults = new Map<string, DomainResult>();
  
  // Track which domains we've already counted (for per_domain mode)
  const countedSignUpDomains = new Set<string>();
  const countedMeetingDomains = new Set<string>();
  const countedPayingDomains = new Set<string>();
  
  for (const event of events) {
    const eventEmail = event.email?.toLowerCase() ?? null;
    const eventDomain = normalizeDomain(event.domain ?? extractDomain(event.email));
    
    if (!eventDomain) continue;
    
    // Look up send time - hard match first, then soft match
    let sendTime: Date | null = null;
    let matchType: 'HARD_MATCH' | 'SOFT_MATCH' = 'SOFT_MATCH';
    
    // Try hard match (exact email)
    if (eventEmail && emailSendTimes.has(eventEmail)) {
      sendTime = emailSendTimes.get(eventEmail)!;
      matchType = 'HARD_MATCH';
    } 
    // Try soft match (domain) if enabled
    else if (settings.softMatchEnabled && domainSendTimes.has(eventDomain)) {
      sendTime = domainSendTimes.get(eventDomain)!;
      matchType = 'SOFT_MATCH';
    }
    
    // Not attributed - never emailed this person/domain
    if (!sendTime) {
      if (event.event_type === 'sign_up') stats.notMatchedSignUps++;
      else if (event.event_type === 'meeting_booked') stats.notMatchedMeetings++;
      else if (event.event_type === 'paying_customer') stats.notMatchedPaying++;
      continue;
    }
    
    // Check if send was before event
    const eventTime = new Date(event.event_time);
    if (sendTime > eventTime) {
      // Event happened before we emailed - not attributed
      if (event.event_type === 'sign_up') stats.notMatchedSignUps++;
      else if (event.event_type === 'meeting_booked') stats.notMatchedMeetings++;
      else if (event.event_type === 'paying_customer') stats.notMatchedPaying++;
      continue;
    }
    
    // Calculate days since email (using client-specific window)
    const daysSince = Math.floor((eventTime.getTime() - sendTime.getTime()) / (1000 * 60 * 60 * 24));
    const isWithinWindow = daysSince <= settings.windowDays;
    
    // Determine the mode for this event type
    const eventMode = event.event_type === 'sign_up' ? settings.signUpsMode :
                      event.event_type === 'meeting_booked' ? settings.meetingsMode :
                      settings.payingMode;
    
    // For per_domain mode, check if we've already counted this domain
    const alreadyCounted = eventMode === 'per_domain' && (
      (event.event_type === 'sign_up' && countedSignUpDomains.has(eventDomain)) ||
      (event.event_type === 'meeting_booked' && countedMeetingDomains.has(eventDomain)) ||
      (event.event_type === 'paying_customer' && countedPayingDomains.has(eventDomain))
    );
    
    // Count attributed events (within window and not already counted for per_domain)
    if (isWithinWindow && !alreadyCounted) {
      if (event.event_type === 'sign_up') {
        stats.attributedSignUps++;
        if (matchType === 'HARD_MATCH') stats.hardMatchSignUps++;
        else stats.softMatchSignUps++;
        if (eventMode === 'per_domain') countedSignUpDomains.add(eventDomain);
      } else if (event.event_type === 'meeting_booked') {
        stats.attributedMeetings++;
        if (matchType === 'HARD_MATCH') stats.hardMatchMeetings++;
        else stats.softMatchMeetings++;
        if (eventMode === 'per_domain') countedMeetingDomains.add(eventDomain);
      } else if (event.event_type === 'paying_customer') {
        stats.attributedPaying++;
        if (matchType === 'HARD_MATCH') stats.hardMatchPaying++;
        else stats.softMatchPaying++;
        if (eventMode === 'per_domain') countedPayingDomains.add(eventDomain);
      }
    } else if (!isWithinWindow) {
      // Outside window - we emailed them, but event happened too late
      if (event.event_type === 'sign_up') stats.outsideWindowSignUps++;
      else if (event.event_type === 'meeting_booked') stats.outsideWindowMeetings++;
      else if (event.event_type === 'paying_customer') stats.outsideWindowPaying++;
    }
    // Note: if alreadyCounted && isWithinWindow, we skip counting (domain already attributed)
    
    // Aggregate by domain (for domains view - always track)
    if (isWithinWindow) {
      const existing = domainResults.get(eventDomain);
      if (existing) {
        existing.isWithinWindow = existing.isWithinWindow || isWithinWindow;
        existing.hasSignUp = existing.hasSignUp || event.event_type === 'sign_up';
        existing.hasMeetingBooked = existing.hasMeetingBooked || event.event_type === 'meeting_booked';
        existing.hasPayingCustomer = existing.hasPayingCustomer || event.event_type === 'paying_customer';
        if (matchType === 'HARD_MATCH') existing.matchType = 'HARD_MATCH';
        if (!existing.firstEvent || eventTime < existing.firstEvent) existing.firstEvent = eventTime;
      } else {
        domainResults.set(eventDomain, {
          domain: eventDomain,
          firstEmailSent: sendTime,
          firstEvent: eventTime,
          isWithinWindow,
          matchType,
          hasSignUp: event.event_type === 'sign_up',
          hasMeetingBooked: event.event_type === 'meeting_booked',
          hasPayingCustomer: event.event_type === 'paying_customer',
          hasPositiveReply: false,
        });
      }
    }
  }
  
  // ============ PHASE 6: Process positive replies ============
  console.log('Processing positive replies...');
  // Positive replies are ALWAYS attributed - they replied to OUR email
  // No 31-day window needed - if they replied, it counts
  // All positive replies are hard matches (we emailed this exact person, they replied)
  
  for (const pr of positiveReplies) {
    const email = pr.lead_email?.toLowerCase();
    const domain = normalizeDomain(pr.company_domain ?? extractDomain(pr.lead_email));
    
    if (!domain) continue;
    
    // Get send time for this email (they replied, so we must have sent)
    const sendTime = email ? emailSendTimes.get(email) : null;
    
    // Count as attributed (positive replies are always 100% attributed as hard match)
    stats.attributedPositiveReplies++;
    stats.hardMatchPositiveReplies++;
    
    // Aggregate by domain
    const existing = domainResults.get(domain);
    const eventTime = pr.last_interaction_time ? new Date(pr.last_interaction_time) : null;
    
    if (existing) {
      existing.hasPositiveReply = true;
      // Positive reply is always a hard match (we emailed this exact person)
      existing.matchType = 'HARD_MATCH';
      existing.isWithinWindow = true; // Positive replies always count
      if (eventTime && (!existing.firstEvent || eventTime < existing.firstEvent)) {
        existing.firstEvent = eventTime;
      }
    } else {
      domainResults.set(domain, {
        domain,
        firstEmailSent: sendTime || null,
        firstEvent: eventTime,
        isWithinWindow: true, // Positive replies always count
        matchType: 'HARD_MATCH', // We emailed this exact person
        hasSignUp: false,
        hasMeetingBooked: false,
        hasPayingCustomer: false,
        hasPositiveReply: true,
      });
    }
  }
  
  // Calculate domain breakdown stats
  stats.totalDomains = domainResults.size;
  for (const d of domainResults.values()) {
    if (d.hasPositiveReply) stats.domainsWithReplies++;
    if (d.hasSignUp) stats.domainsWithSignups++;
    if (d.hasMeetingBooked) stats.domainsWithMeetings++;
    if (d.hasPayingCustomer) stats.domainsWithPaying++;
    
    // Count domains with multiple event types
    const eventCount = [d.hasPositiveReply, d.hasSignUp, d.hasMeetingBooked, d.hasPayingCustomer].filter(Boolean).length;
    if (eventCount > 1) stats.domainsWithMultipleEvents++;
  }
  
  console.log(`Total attributed domains: ${stats.totalDomains}`);
  console.log(`  - With replies: ${stats.domainsWithReplies}`);
  console.log(`  - With sign-ups: ${stats.domainsWithSignups}`);
  console.log(`  - With meetings: ${stats.domainsWithMeetings}`);
  console.log(`  - With paying: ${stats.domainsWithPaying}`);
  console.log(`  - With multiple events: ${stats.domainsWithMultipleEvents}`);
  
  // ============ PHASE 7: Save to database ============
  console.log(`Saving ${domainResults.size} attributed domains...`);
  
  for (const result of domainResults.values()) {
    try {
      await attrQuery(`
        INSERT INTO attributed_domain (
          client_config_id, domain, first_email_sent_at, first_event_at,
          is_within_window, match_type,
          has_sign_up, has_meeting_booked, has_paying_customer, has_positive_reply
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (client_config_id, domain) DO UPDATE SET
          first_email_sent_at = COALESCE(EXCLUDED.first_email_sent_at, attributed_domain.first_email_sent_at),
          first_event_at = LEAST(COALESCE(EXCLUDED.first_event_at, attributed_domain.first_event_at), COALESCE(attributed_domain.first_event_at, EXCLUDED.first_event_at)),
          is_within_window = attributed_domain.is_within_window OR EXCLUDED.is_within_window,
          has_sign_up = attributed_domain.has_sign_up OR EXCLUDED.has_sign_up,
          has_meeting_booked = attributed_domain.has_meeting_booked OR EXCLUDED.has_meeting_booked,
          has_paying_customer = attributed_domain.has_paying_customer OR EXCLUDED.has_paying_customer,
          has_positive_reply = attributed_domain.has_positive_reply OR EXCLUDED.has_positive_reply,
          match_type = CASE WHEN EXCLUDED.match_type = 'HARD_MATCH' THEN 'HARD_MATCH' ELSE attributed_domain.match_type END,
          updated_at = NOW()
      `, [
        clientConfig.id,
        result.domain,
        result.firstEmailSent,
        result.firstEvent,
        result.isWithinWindow,
        result.matchType,
        result.hasSignUp,
        result.hasMeetingBooked,
        result.hasPayingCustomer,
        result.hasPositiveReply,
      ]);
    } catch (error) {
      console.error(`Error saving domain ${result.domain}:`, error);
      stats.errors++;
    }
  }
  
  // ============ PHASE 8: Update client stats ============
  console.log('Updating client stats...');
  await attrQuery(`
    UPDATE client_config SET
      total_emails_sent = $2,
      total_positive_replies = $3,
      total_sign_ups = $4,
      total_meetings_booked = $5,
      total_paying_customers = $6,
      attributed_positive_replies = $7,
      attributed_sign_ups = $8,
      attributed_meetings_booked = $9,
      attributed_paying_customers = $10,
      hard_match_positive_replies = $11,
      hard_match_sign_ups = $12,
      hard_match_meetings = $13,
      hard_match_paying = $14,
      soft_match_positive_replies = $15,
      soft_match_sign_ups = $16,
      soft_match_meetings = $17,
      soft_match_paying = $18,
      outside_window_sign_ups = $19,
      outside_window_meetings = $20,
      outside_window_paying = $21,
      not_matched_sign_ups = $22,
      not_matched_meetings = $23,
      not_matched_paying = $24,
      domains_with_replies = $25,
      domains_with_signups = $26,
      domains_with_meetings = $27,
      domains_with_paying = $28,
      domains_with_multiple_events = $29,
      last_processed_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
  `, [
    clientConfig.id,
    stats.totalEmailsSent,
    stats.totalPositiveReplies,
    stats.totalSignUps,
    stats.totalMeetings,
    stats.totalPaying,
    stats.attributedPositiveReplies,
    stats.attributedSignUps,
    stats.attributedMeetings,
    stats.attributedPaying,
    stats.hardMatchPositiveReplies,
    stats.hardMatchSignUps,
    stats.hardMatchMeetings,
    stats.hardMatchPaying,
    stats.softMatchPositiveReplies,
    stats.softMatchSignUps,
    stats.softMatchMeetings,
    stats.softMatchPaying,
    stats.outsideWindowSignUps,
    stats.outsideWindowMeetings,
    stats.outsideWindowPaying,
    stats.notMatchedSignUps,
    stats.notMatchedMeetings,
    stats.notMatchedPaying,
    stats.domainsWithReplies,
    stats.domainsWithSignups,
    stats.domainsWithMeetings,
    stats.domainsWithPaying,
    stats.domainsWithMultipleEvents,
  ]);
  
  console.log(`Completed ${clientConfig.client_name}:`);
  console.log(`  Emails Sent: ${stats.totalEmailsSent}`);
  console.log(`  Positive Replies: ${stats.totalPositiveReplies} (${stats.attributedPositiveReplies} attributed - ${stats.hardMatchPositiveReplies} hard, ${stats.softMatchPositiveReplies} soft)`);
  console.log(`  Sign-ups: ${stats.totalSignUps} (${stats.attributedSignUps} attributed, ${stats.outsideWindowSignUps} outside window, ${stats.notMatchedSignUps} not matched)`);
  console.log(`  Meetings: ${stats.totalMeetings} (${stats.attributedMeetings} attributed, ${stats.outsideWindowMeetings} outside window, ${stats.notMatchedMeetings} not matched)`);
  console.log(`  Paying: ${stats.totalPaying} (${stats.attributedPaying} attributed, ${stats.outsideWindowPaying} outside window, ${stats.notMatchedPaying} not matched)`);
  console.log(`  Total Domains: ${stats.totalDomains}`);
  console.log(`  Errors: ${stats.errors}`);
  
  return stats;
}

async function processAllClientsAsync(job: JobState): Promise<void> {
  try {
    // Get eligible client IDs from production (filtered by op_status OR in exception list)
    console.log(`Filtering clients by op_status: ${VALID_OP_STATUSES.join(', ')}`);
    console.log(`Exception clients (always included): ${Array.from(ALWAYS_INCLUDE_CLIENTS).join(', ')}`);
    
    const eligibleClients = await prodQuery<{ id: string }>(`
      SELECT id FROM client
      WHERE is_active = true 
        AND is_deleted = false
        AND (op_status = ANY($1) OR client_name = ANY($2))
    `, [VALID_OP_STATUSES, Array.from(ALWAYS_INCLUDE_CLIENTS)]);
    
    const eligibleClientIds = new Set(eligibleClients.map(c => c.id));
    console.log(`Found ${eligibleClientIds.size} eligible clients in production`);
    
    // Get client configs and filter to only eligible ones
    const allConfigs = await attrQuery<{ client_id: string; client_name: string }>(`
      SELECT client_id, client_name FROM client_config ORDER BY client_name
    `);
    
    const clients = allConfigs.filter(c => eligibleClientIds.has(c.client_id));
    console.log(`Processing ${clients.length} eligible clients (skipping ${allConfigs.length - clients.length} ineligible)...`);
    
    job.progress = { current: 0, total: clients.length };
    
    const results: Array<{ client: string; stats: ProcessingStats }> = [];
    
    // Clients to skip (in addition to op_status filter)
    const SKIP_CLIENTS = new Set(['Fyxer']);
    
    const emptyStats: ProcessingStats = {
      totalSignUps: 0, totalMeetings: 0, totalPaying: 0, totalPositiveReplies: 0,
      attributedSignUps: 0, attributedMeetings: 0, attributedPaying: 0, attributedPositiveReplies: 0,
      hardMatchPositiveReplies: 0, hardMatchSignUps: 0, hardMatchMeetings: 0, hardMatchPaying: 0,
      softMatchPositiveReplies: 0, softMatchSignUps: 0, softMatchMeetings: 0, softMatchPaying: 0,
      outsideWindowSignUps: 0, outsideWindowMeetings: 0, outsideWindowPaying: 0,
      notMatchedSignUps: 0, notMatchedMeetings: 0, notMatchedPaying: 0,
      totalDomains: 0, domainsWithReplies: 0, domainsWithSignups: 0, domainsWithMeetings: 0,
      domainsWithPaying: 0, domainsWithMultipleEvents: 0, totalEmailsSent: 0, errors: 0
    };
    
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      job.progress = { current: i, total: clients.length, currentClient: client.client_name };
      
      // Skip excluded clients
      if (SKIP_CLIENTS.has(client.client_name)) {
        console.log(`\n=== Skipping ${i + 1}/${clients.length}: ${client.client_name} (excluded) ===`);
        results.push({ client: client.client_name, stats: { ...emptyStats } });
        continue;
      }
      
      try {
        console.log(`\n=== Processing ${i + 1}/${clients.length}: ${client.client_name} ===`);
        const stats = await processClient(client.client_id);
        results.push({ client: client.client_name, stats });
      } catch (error) {
        console.error(`Failed to process ${client.client_name}:`, error);
        results.push({ client: client.client_name, stats: { ...emptyStats, errors: 1 } });
      }
      
      job.progress = { current: i + 1, total: clients.length };
    }
    
    job.status = 'completed';
    job.completedAt = new Date();
    job.result = { clientCount: clients.length, results };
    
    // Aggregate totals
    const totals = {
      domains: results.reduce((sum, r) => sum + r.stats.totalDomains, 0),
      positiveReplies: results.reduce((sum, r) => sum + r.stats.attributedPositiveReplies, 0),
      signUps: results.reduce((sum, r) => sum + r.stats.attributedSignUps, 0),
      meetings: results.reduce((sum, r) => sum + r.stats.attributedMeetings, 0),
      paying: results.reduce((sum, r) => sum + r.stats.attributedPaying, 0),
    };
    
    console.log('\n========== PROCESSING COMPLETE ==========');
    console.log(`Eligible clients processed: ${clients.length}`);
    console.log(`Total Attributed Domains: ${totals.domains}`);
    console.log(`Total Attributed Positive Replies: ${totals.positiveReplies}`);
    console.log(`Total Attributed Sign-ups: ${totals.signUps}`);
    console.log(`Total Attributed Meetings: ${totals.meetings}`);
    console.log(`Total Attributed Paying: ${totals.paying}`);
    console.log('==========================================\n');
    
  } catch (error) {
    job.status = 'failed';
    job.completedAt = new Date();
    job.error = (error as Error).message;
    console.error('Process all failed:', error);
  }
}

// ============ HTTP Server ============
const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await prodPool.query('SELECT 1');
    await attrPool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: (error as Error).message });
  }
});

app.get('/job/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

app.get('/jobs', (req, res) => {
  const jobs = Array.from(activeJobs.values())
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 20);
  res.json(jobs);
});

app.post('/sync-clients', async (req, res) => {
  try {
    console.log('Received sync-clients request');
    const newClients = await syncClientsFromProduction();
    res.json({ success: true, newClients, count: newClients.length });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/process-client', async (req, res) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId is required' });
  }
  
  const job = createJob('process-client');
  console.log(`Started job ${job.id} for client: ${clientId}`);
  res.json({ success: true, jobId: job.id, message: 'Processing started' });
  
  processClient(clientId)
    .then(stats => {
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = stats;
    })
    .catch(error => {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = (error as Error).message;
    });
});

app.post('/process-all', async (req, res) => {
  const runningJob = Array.from(activeJobs.values()).find(
    j => j.type === 'process-all' && j.status === 'running'
  );
  
  if (runningJob) {
    return res.json({ 
      success: true, 
      jobId: runningJob.id, 
      message: 'Processing already in progress',
      progress: runningJob.progress
    });
  }
  
  const job = createJob('process-all');
  console.log(`Started job ${job.id} to process all clients`);
  res.json({ success: true, jobId: job.id, message: 'Processing started' });
  
  processAllClientsAsync(job);
});

app.post('/create-indexes', async (req, res) => {
  console.log('Creating indexes on production database...');
  const results: Array<{ index: string; status: string; error?: string }> = [];
  
  const indexes = [
    { name: 'idx_prospect_lead_email_lower', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_lead_email_lower ON prospect (LOWER(lead_email))' },
    { name: 'idx_prospect_company_domain_lower', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_company_domain_lower ON prospect (LOWER(company_domain))' },
    { name: 'idx_email_conversation_prospect_id', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_conversation_prospect_id ON email_conversation (prospect_id)' },
    { name: 'idx_email_conversation_client_int_type', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_conversation_client_int_type ON email_conversation (client_integration_id, type)' },
    { name: 'idx_email_conversation_timestamp', sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_conversation_timestamp ON email_conversation (timestamp_email)' },
  ];
  
  for (const idx of indexes) {
    try {
      console.log(`Creating index: ${idx.name}...`);
      await prodPool.query(idx.sql);
      results.push({ index: idx.name, status: 'created' });
      console.log(`  ✓ ${idx.name} created`);
    } catch (error) {
      const errMsg = (error as Error).message;
      if (errMsg.includes('already exists')) {
        results.push({ index: idx.name, status: 'exists' });
        console.log(`  - ${idx.name} already exists`);
      } else {
        results.push({ index: idx.name, status: 'error', error: errMsg });
        console.error(`  ✗ ${idx.name} failed:`, errMsg);
      }
    }
  }
  
  console.log('Index creation complete');
  res.json({ success: true, results });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Worker API listening on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /jobs');
  console.log('  GET  /job/:jobId');
  console.log('  POST /sync-clients');
  console.log('  POST /process-client { clientId }');
  console.log('  POST /process-all');
  console.log('  POST /create-indexes');
});
