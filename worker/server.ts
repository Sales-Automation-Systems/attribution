// Railway Background Worker with HTTP API
// Processes attribution jobs and exposes HTTP endpoints for triggering

import express from 'express';
import { Pool } from 'pg';

// Initialize pools directly (not using path aliases since this runs standalone)
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

// ============ Sync Logic ============
async function syncClientsFromProduction(): Promise<string[]> {
  console.log('Syncing clients from production...');
  
  // Get active clients from production
  const productionClients = await prodQuery<{ id: string; client_name: string }>(`
    SELECT id, client_name
    FROM client
    WHERE is_active = true AND is_deleted = false
    ORDER BY client_name
  `);
  
  console.log(`Found ${productionClients.length} active clients in production`);
  
  // Get existing configs
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
      console.log(`Created config for: ${client.client_name}`);
    }
  }
  
  console.log(`Sync complete. ${newClients.length} new clients added.`);
  return newClients;
}

// ============ Processing Logic ============
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
  
  // Get client config
  const configs = await attrQuery<{ id: string; client_name: string }>(`
    SELECT id, client_name FROM client_config WHERE client_id = $1
  `, [clientId]);
  
  if (configs.length === 0) {
    throw new Error(`Client config not found for: ${clientId}`);
  }
  
  const clientConfig = configs[0];
  console.log(`Processing: ${clientConfig.client_name}`);
  
  // Count total events
  const countResult = await prodQuery<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM attribution_event ae
    JOIN client_integration ci ON ae.client_integration_id = ci.id
    WHERE ci.client_id = $1
      AND ae.event_type IN ('sign_up', 'meeting_booked', 'paying_customer')
  `, [clientId]);
  
  const totalEvents = parseInt(countResult[0]?.count || '0', 10);
  console.log(`Total events to process: ${totalEvents}`);
  
  const stats: ProcessingStats = {
    totalEvents,
    processedEvents: 0,
    attributed: 0,
    outsideWindow: 0,
    neverEmailed: 0,
    errors: 0,
  };
  
  // Process in batches
  const BATCH_SIZE = 500;
  let lastEventId: string | null = null;
  
  while (true) {
    // Fetch batch of events
    let events;
    if (lastEventId) {
      events = await prodQuery<{
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
          AND ae.id > $2
        ORDER BY ae.id
        LIMIT $3
      `, [clientId, lastEventId, BATCH_SIZE]);
    } else {
      events = await prodQuery<{
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
        ORDER BY ae.id
        LIMIT $2
      `, [clientId, BATCH_SIZE]);
    }
    
    if (events.length === 0) break;
    
    console.log(`Processing batch of ${events.length} events...`);
    
    for (const event of events) {
      try {
        const eventEmail = event.email?.toLowerCase() ?? null;
        const eventDomain = normalizeDomain(event.domain ?? extractDomain(eventEmail));
        
        if (!eventDomain) {
          stats.neverEmailed++;
          stats.processedEvents++;
          lastEventId = event.id;
          continue;
        }
        
        // Check for hard match (exact email)
        let matchedEmail: { timestamp_email: Date } | null = null;
        
        if (eventEmail) {
          const hardMatches = await prodQuery<{ timestamp_email: Date }>(`
            SELECT ec.timestamp_email
            FROM email_conversation ec
            JOIN prospect p ON ec.prospect_id = p.id
            JOIN client_integration ci ON ec.client_integration_id = ci.id
            WHERE ec.type = 'Sent'
              AND LOWER(p.lead_email) = LOWER($1)
              AND ci.client_id = $2
              AND ec.timestamp_email <= $3::timestamp
            ORDER BY ec.timestamp_email DESC
            LIMIT 1
          `, [eventEmail, clientId, event.event_time]);
          
          if (hardMatches.length > 0) {
            matchedEmail = hardMatches[0];
          }
        }
        
        // Check for soft match (domain) if no hard match
        if (!matchedEmail && eventDomain) {
          const softMatches = await prodQuery<{ timestamp_email: Date }>(`
            SELECT ec.timestamp_email
            FROM email_conversation ec
            JOIN prospect p ON ec.prospect_id = p.id
            JOIN client_integration ci ON ec.client_integration_id = ci.id
            WHERE ec.type = 'Sent'
              AND LOWER(p.company_domain) = LOWER($1)
              AND ci.client_id = $2
              AND ec.timestamp_email <= $3::timestamp
            ORDER BY ec.timestamp_email DESC
            LIMIT 1
          `, [eventDomain, clientId, event.event_time]);
          
          if (softMatches.length > 0) {
            matchedEmail = softMatches[0];
          }
        }
        
        // Classify result
        if (matchedEmail) {
          const daysSince = Math.floor(
            (new Date(event.event_time).getTime() - new Date(matchedEmail.timestamp_email).getTime()) 
            / (1000 * 60 * 60 * 24)
          );
          
          if (daysSince <= 31) {
            stats.attributed++;
          } else {
            stats.outsideWindow++;
          }
          
          // Upsert attributed domain
          await attrQuery(`
            INSERT INTO attributed_domain (
              client_config_id, domain, first_email_sent_at, first_event_at,
              is_within_window, match_type
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (client_config_id, domain) DO UPDATE SET
              first_email_sent_at = COALESCE(attributed_domain.first_email_sent_at, EXCLUDED.first_email_sent_at),
              first_event_at = COALESCE(attributed_domain.first_event_at, EXCLUDED.first_event_at),
              is_within_window = attributed_domain.is_within_window OR EXCLUDED.is_within_window,
              updated_at = NOW()
          `, [
            clientConfig.id,
            eventDomain,
            matchedEmail.timestamp_email,
            event.event_time,
            daysSince <= 31,
            eventEmail ? 'HARD_MATCH' : 'SOFT_MATCH'
          ]);
        } else {
          stats.neverEmailed++;
        }
        
        stats.processedEvents++;
        lastEventId = event.id;
        
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        stats.errors++;
        stats.processedEvents++;
        lastEventId = event.id;
      }
    }
    
    console.log(`Progress: ${stats.processedEvents}/${totalEvents}`);
  }
  
  console.log(`Completed processing ${clientConfig.client_name}:`);
  console.log(`  Attributed: ${stats.attributed}`);
  console.log(`  Outside Window: ${stats.outsideWindow}`);
  console.log(`  Never Emailed: ${stats.neverEmailed}`);
  console.log(`  Errors: ${stats.errors}`);
  
  return stats;
}

async function processAllClients(): Promise<{ clientCount: number; results: Array<{ client: string; stats: ProcessingStats }> }> {
  const clients = await attrQuery<{ client_id: string; client_name: string }>(`
    SELECT client_id, client_name FROM client_config ORDER BY client_name
  `);
  
  console.log(`Processing ${clients.length} clients...`);
  
  const results: Array<{ client: string; stats: ProcessingStats }> = [];
  
  for (const client of clients) {
    try {
      const stats = await processClient(client.client_id);
      results.push({ client: client.client_name, stats });
    } catch (error) {
      console.error(`Failed to process ${client.client_name}:`, error);
      results.push({
        client: client.client_name,
        stats: { totalEvents: 0, processedEvents: 0, attributed: 0, outsideWindow: 0, neverEmailed: 0, errors: 1 }
      });
    }
  }
  
  return { clientCount: clients.length, results };
}

// ============ HTTP Server ============
const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await prodPool.query('SELECT 1');
    await attrPool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: (error as Error).message });
  }
});

// Sync clients
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

// Process single client
app.post('/process-client', async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    console.log(`Received process-client request for: ${clientId}`);
    const stats = await processClient(clientId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Process client failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Process all clients
app.post('/process-all', async (req, res) => {
  try {
    console.log('Received process-all request');
    const result = await processAllClients();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Process all failed:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Worker API listening on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health');
  console.log('  POST /sync-clients');
  console.log('  POST /process-client { clientId }');
  console.log('  POST /process-all');
});

