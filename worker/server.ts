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

// ============ Sync Logic ============
async function syncClientsFromProduction(): Promise<string[]> {
  console.log('Syncing clients from production...');
  console.log(`Only syncing clients with op_status: ${VALID_OP_STATUSES.join(', ')}`);
  
  const productionClients = await prodQuery<{ id: string; client_name: string; op_status: string }>(`
    SELECT id, client_name, op_status
    FROM client
    WHERE is_active = true 
      AND is_deleted = false
      AND op_status = ANY($1)
    ORDER BY client_name
  `, [VALID_OP_STATUSES]);
  
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
  totalEvents: number;
  processedEvents: number;
  attributed: number;
  outsideWindow: number;
  neverEmailed: number;
  errors: number;
}

async function processClient(clientId: string): Promise<ProcessingStats> {
  console.log(`Processing client: ${clientId}`);
  
  const configs = await attrQuery<{ id: string; client_name: string }>(`
    SELECT id, client_name FROM client_config WHERE client_id = $1
  `, [clientId]);
  
  if (configs.length === 0) {
    throw new Error(`Client config not found for: ${clientId}`);
  }
  
  const clientConfig = configs[0];
  console.log(`Processing: ${clientConfig.client_name}`);
  
  const stats: ProcessingStats = {
    totalEvents: 0,
    processedEvents: 0,
    attributed: 0,
    outsideWindow: 0,
    neverEmailed: 0,
    errors: 0,
  };
  
  // Fetch ALL events for this client in one query
  console.log('Fetching all attribution events...');
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
  
  stats.totalEvents = events.length;
  console.log(`Total events: ${events.length}`);
  
  if (events.length === 0) {
    console.log('No events to process');
    return stats;
  }
  
  // Extract unique emails and domains from events
  const emails = new Set<string>();
  const domains = new Set<string>();
  
  for (const event of events) {
    const email = event.email?.toLowerCase();
    const domain = normalizeDomain(event.domain ?? extractDomain(event.email));
    if (email) emails.add(email);
    if (domain) domains.add(domain);
  }
  
  console.log(`Unique emails: ${emails.size}, unique domains: ${domains.size}`);
  
  // BATCH LOOKUP: Query send times in chunks to avoid timeout
  console.log('Fetching email send times (chunked)...');
  
  // Map: email -> earliest send time
  const emailSendTimes = new Map<string, Date>();
  // Map: domain -> earliest send time  
  const domainSendTimes = new Map<string, Date>();
  
  // Process emails in chunks of 100
  const emailArray = Array.from(emails);
  const CHUNK_SIZE = 100;
  
  for (let i = 0; i < emailArray.length; i += CHUNK_SIZE) {
    const chunk = emailArray.slice(i, i + CHUNK_SIZE);
    if (i % 200 === 0) {
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
  
  console.log(`Found ${emailSendTimes.size} emails with send history`);
  
  // Process domains in chunks of 100
  const domainArray = Array.from(domains);
  
  for (let i = 0; i < domainArray.length; i += CHUNK_SIZE) {
    const chunk = domainArray.slice(i, i + CHUNK_SIZE);
    if (i % 200 === 0) {
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
  
  console.log(`Found ${domainSendTimes.size} domains with send history`)
  
  // Process events using the pre-fetched data
  console.log('Processing events...');
  const domainResults = new Map<string, {
    domain: string;
    firstEmailSent: Date | null;
    firstEvent: Date;
    isWithinWindow: boolean;
    matchType: 'HARD_MATCH' | 'SOFT_MATCH';
    hasSignUp: boolean;
    hasMeetingBooked: boolean;
    hasPayingCustomer: boolean;
  }>();
  
  for (let i = 0; i < events.length; i++) {
    if (i % 100 === 0) {
      console.log(`  Processing event ${i + 1}/${events.length}`);
    }
    
    const event = events[i];
    const eventEmail = event.email?.toLowerCase() ?? null;
    const eventDomain = normalizeDomain(event.domain ?? extractDomain(event.email));
    
    if (!eventDomain) {
      stats.neverEmailed++;
      stats.processedEvents++;
      continue;
    }
    
    // Look up send time - hard match first, then soft match
    let sendTime: Date | null = null;
    let matchType: 'HARD_MATCH' | 'SOFT_MATCH' = 'SOFT_MATCH';
    
    if (eventEmail && emailSendTimes.has(eventEmail)) {
      sendTime = emailSendTimes.get(eventEmail)!;
      matchType = 'HARD_MATCH';
    } else if (domainSendTimes.has(eventDomain)) {
      sendTime = domainSendTimes.get(eventDomain)!;
      matchType = 'SOFT_MATCH';
    }
    
    if (!sendTime) {
      stats.neverEmailed++;
      stats.processedEvents++;
      continue;
    }
    
    // Check if send was before event
    const eventTime = new Date(event.event_time);
    if (sendTime > eventTime) {
      stats.neverEmailed++;
      stats.processedEvents++;
      continue;
    }
    
    // Calculate days since email
    const daysSince = Math.floor((eventTime.getTime() - sendTime.getTime()) / (1000 * 60 * 60 * 24));
    const isWithinWindow = daysSince <= 31;
    
    if (isWithinWindow) {
      stats.attributed++;
    } else {
      stats.outsideWindow++;
    }
    
    // Aggregate results by domain
    const existing = domainResults.get(eventDomain);
    if (existing) {
      existing.isWithinWindow = existing.isWithinWindow || isWithinWindow;
      existing.hasSignUp = existing.hasSignUp || event.event_type === 'sign_up';
      existing.hasMeetingBooked = existing.hasMeetingBooked || event.event_type === 'meeting_booked';
      existing.hasPayingCustomer = existing.hasPayingCustomer || event.event_type === 'paying_customer';
      if (matchType === 'HARD_MATCH') existing.matchType = 'HARD_MATCH';
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
      });
    }
    
    stats.processedEvents++;
  }
  
  // Batch insert/update attributed domains
  console.log(`Saving ${domainResults.size} attributed domains...`);
  for (const result of domainResults.values()) {
    try {
      await attrQuery(`
        INSERT INTO attributed_domain (
          client_config_id, domain, first_email_sent_at, first_event_at,
          is_within_window, match_type,
          has_sign_up, has_meeting_booked, has_paying_customer
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (client_config_id, domain) DO UPDATE SET
          first_email_sent_at = COALESCE(attributed_domain.first_email_sent_at, EXCLUDED.first_email_sent_at),
          first_event_at = COALESCE(attributed_domain.first_event_at, EXCLUDED.first_event_at),
          is_within_window = attributed_domain.is_within_window OR EXCLUDED.is_within_window,
          has_sign_up = attributed_domain.has_sign_up OR EXCLUDED.has_sign_up,
          has_meeting_booked = attributed_domain.has_meeting_booked OR EXCLUDED.has_meeting_booked,
          has_paying_customer = attributed_domain.has_paying_customer OR EXCLUDED.has_paying_customer,
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
      ]);
    } catch (error) {
      console.error(`Error saving domain ${result.domain}:`, error);
      stats.errors++;
    }
  }
  
  console.log(`Completed ${clientConfig.client_name}:`);
  console.log(`  Attributed: ${stats.attributed}`);
  console.log(`  Outside Window: ${stats.outsideWindow}`);
  console.log(`  Never Emailed: ${stats.neverEmailed}`);
  console.log(`  Errors: ${stats.errors}`);
  
  return stats;
}

async function processAllClientsAsync(job: JobState): Promise<void> {
  try {
    // Get eligible client IDs from production (filtered by op_status)
    console.log(`Filtering clients by op_status: ${VALID_OP_STATUSES.join(', ')}`);
    const eligibleClients = await prodQuery<{ id: string }>(`
      SELECT id FROM client
      WHERE is_active = true 
        AND is_deleted = false
        AND op_status = ANY($1)
    `, [VALID_OP_STATUSES]);
    
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
    
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      job.progress = { current: i, total: clients.length, currentClient: client.client_name };
      
      // Skip excluded clients
      if (SKIP_CLIENTS.has(client.client_name)) {
        console.log(`\n=== Skipping ${i + 1}/${clients.length}: ${client.client_name} (excluded) ===`);
        results.push({
          client: client.client_name,
          stats: { totalEvents: 0, processedEvents: 0, attributed: 0, outsideWindow: 0, neverEmailed: 0, errors: 0 }
        });
        continue;
      }
      
      try {
        console.log(`\n=== Processing ${i + 1}/${clients.length}: ${client.client_name} ===`);
        const stats = await processClient(client.client_id);
        results.push({ client: client.client_name, stats });
      } catch (error) {
        console.error(`Failed to process ${client.client_name}:`, error);
        results.push({
          client: client.client_name,
          stats: { totalEvents: 0, processedEvents: 0, attributed: 0, outsideWindow: 0, neverEmailed: 0, errors: 1 }
        });
      }
      
      job.progress = { current: i + 1, total: clients.length };
    }
    
    job.status = 'completed';
    job.completedAt = new Date();
    job.result = { clientCount: clients.length, results };
    
    const totalAttributed = results.reduce((sum, r) => sum + r.stats.attributed, 0);
    const totalOutside = results.reduce((sum, r) => sum + r.stats.outsideWindow, 0);
    const totalNever = results.reduce((sum, r) => sum + r.stats.neverEmailed, 0);
    
    console.log('\n========== PROCESSING COMPLETE ==========');
    console.log(`Eligible clients processed: ${clients.length}`);
    console.log(`Total Attributed: ${totalAttributed}`);
    console.log(`Total Outside Window: ${totalOutside}`);
    console.log(`Total Never Emailed: ${totalNever}`);
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
