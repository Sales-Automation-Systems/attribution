// Production Database Queries (READ ONLY)
import { prodQuery } from '../index';
import type {
  Client,
  ClientIntegration,
  Prospect,
  EmailConversation,
  AttributionEvent,
} from './types';

// Client queries
export async function getAllActiveClients(): Promise<Client[]> {
  return prodQuery<Client>(`
    SELECT id, client_name, is_active, is_deleted, created_at, updated_at
    FROM client
    WHERE is_active = true AND is_deleted = false
    ORDER BY client_name
  `);
}

export async function getClientById(clientId: string): Promise<Client | null> {
  const rows = await prodQuery<Client>(
    `SELECT id, client_name, is_active, is_deleted, created_at, updated_at
     FROM client WHERE id = $1`,
    [clientId]
  );
  return rows[0] || null;
}

// Client integration queries
export async function getClientIntegrations(
  clientId: string
): Promise<ClientIntegration[]> {
  return prodQuery<ClientIntegration>(
    `SELECT id, client_id, integration_type, is_active, created_at
     FROM client_integration
     WHERE client_id = $1 AND is_active = true`,
    [clientId]
  );
}

// Attribution event queries
export async function getAttributionEvents(
  clientId: string,
  afterEventId?: string,
  limit = 1000
): Promise<AttributionEvent[]> {
  if (afterEventId) {
    return prodQuery<AttributionEvent>(
      `SELECT ae.id, ae.client_integration_id, ci.client_id, ae.event_type, 
              ae.email, ae.domain, ae.event_time, ae.metadata, ae.created_at
       FROM attribution_event ae
       JOIN client_integration ci ON ae.client_integration_id = ci.id
       WHERE ci.client_id = $1 
         AND ae.id > $2
         AND ae.event_type IN ('sign_up', 'meeting_booked', 'paying_customer')
       ORDER BY ae.id
       LIMIT $3`,
      [clientId, afterEventId, limit]
    );
  }

  return prodQuery<AttributionEvent>(
    `SELECT ae.id, ae.client_integration_id, ci.client_id, ae.event_type, 
            ae.email, ae.domain, ae.event_time, ae.metadata, ae.created_at
     FROM attribution_event ae
     JOIN client_integration ci ON ae.client_integration_id = ci.id
     WHERE ci.client_id = $1 
       AND ae.event_type IN ('sign_up', 'meeting_booked', 'paying_customer')
     ORDER BY ae.id
     LIMIT $2`,
    [clientId, limit]
  );
}

export async function countAttributionEvents(clientId: string): Promise<number> {
  const rows = await prodQuery<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM attribution_event ae
     JOIN client_integration ci ON ae.client_integration_id = ci.id
     WHERE ci.client_id = $1 
       AND ae.event_type IN ('sign_up', 'meeting_booked', 'paying_customer')`,
    [clientId]
  );
  return parseInt(rows[0]?.count || '0', 10);
}

// Email conversation queries for matching
// Find the most recent email sent to this exact email address BEFORE the event
export async function findHardMatchEmail(
  clientId: string,
  email: string,
  eventTime: Date
): Promise<EmailConversation | null> {
  const rows = await prodQuery<EmailConversation>(
    `SELECT ec.id, ec.prospect_id, ec.client_integration_id, ec.type,
            ec.timestamp_email, ec.subject, ec.body, ec.created_at
     FROM email_conversation ec
     JOIN prospect p ON ec.prospect_id = p.id
     JOIN client_integration ci ON ec.client_integration_id = ci.id
     WHERE ec.type = 'Sent'
       AND LOWER(p.lead_email) = LOWER($1)
       AND ci.client_id = $2
       AND ec.timestamp_email <= $3::timestamp
     ORDER BY ec.timestamp_email DESC
     LIMIT 1`,
    [email, clientId, eventTime]
  );
  return rows[0] || null;
}

// Find the most recent email sent to this domain BEFORE the event
export async function findSoftMatchEmail(
  clientId: string,
  domain: string,
  eventTime: Date
): Promise<EmailConversation | null> {
  const rows = await prodQuery<EmailConversation>(
    `SELECT ec.id, ec.prospect_id, ec.client_integration_id, ec.type,
            ec.timestamp_email, ec.subject, ec.body, ec.created_at
     FROM email_conversation ec
     JOIN prospect p ON ec.prospect_id = p.id
     JOIN client_integration ci ON ec.client_integration_id = ci.id
     WHERE ec.type = 'Sent'
       AND LOWER(p.company_domain) = LOWER($1)
       AND ci.client_id = $2
       AND ec.timestamp_email <= $3::timestamp
     ORDER BY ec.timestamp_email DESC
     LIMIT 1`,
    [domain, clientId, eventTime]
  );
  return rows[0] || null;
}

// Get all emails sent/received for a domain (for timeline view)
export async function getEmailsForDomain(
  clientId: string,
  domain: string
): Promise<EmailConversation[]> {
  return prodQuery<EmailConversation>(
    `SELECT ec.id, ec.prospect_id, ec.client_integration_id, ec.type,
            ec.timestamp_email, ec.subject, ec.body, ec.created_at
     FROM email_conversation ec
     JOIN prospect p ON ec.prospect_id = p.id
     JOIN client_integration ci ON ec.client_integration_id = ci.id
     WHERE ci.client_id = $1
       AND LOWER(p.company_domain) = LOWER($2)
     ORDER BY ec.timestamp_email`,
    [clientId, domain]
  );
}

// Get prospect email for a conversation
export async function getProspectByEmail(
  clientId: string,
  email: string
): Promise<Prospect | null> {
  const rows = await prodQuery<Prospect>(
    `SELECT p.id, p.client_integration_id, p.lead_email, p.company_domain,
            p.lead_category_id, p.last_interaction_time, p.created_at
     FROM prospect p
     JOIN client_integration ci ON p.client_integration_id = ci.id
     WHERE ci.client_id = $1 AND LOWER(p.lead_email) = LOWER($2)
     LIMIT 1`,
    [clientId, email]
  );
  return rows[0] || null;
}

// Positive reply queries
export async function getPositiveReplies(clientId: string): Promise<
  Array<
    Prospect & {
      category_name: string;
    }
  >
> {
  return prodQuery(
    `SELECT p.id, p.client_integration_id, p.lead_email, p.company_domain,
            p.lead_category_id, p.last_interaction_time, p.created_at,
            lc.name as category_name
     FROM prospect p
     JOIN lead_category lc ON p.lead_category_id = lc.id
     JOIN client_integration ci ON p.client_integration_id = ci.id
     WHERE lc.sentiment = 'POSITIVE'
       AND ci.client_id = $1`,
    [clientId]
  );
}

// Get first email sent to a specific email address
export async function getFirstEmailSentToAddress(
  clientId: string,
  email: string
): Promise<EmailConversation | null> {
  const rows = await prodQuery<EmailConversation>(
    `SELECT ec.id, ec.prospect_id, ec.client_integration_id, ec.type,
            ec.timestamp_email, ec.subject, ec.body, ec.created_at
     FROM email_conversation ec
     JOIN prospect p ON ec.prospect_id = p.id
     JOIN client_integration ci ON ec.client_integration_id = ci.id
     WHERE ec.type = 'Sent'
       AND LOWER(p.lead_email) = LOWER($1)
       AND ci.client_id = $2
     ORDER BY ec.timestamp_email ASC
     LIMIT 1`,
    [email, clientId]
  );
  return rows[0] || null;
}

// Get first email sent to a domain
export async function getFirstEmailSentToDomain(
  clientId: string,
  domain: string
): Promise<EmailConversation | null> {
  const rows = await prodQuery<EmailConversation>(
    `SELECT ec.id, ec.prospect_id, ec.client_integration_id, ec.type,
            ec.timestamp_email, ec.subject, ec.body, ec.created_at
     FROM email_conversation ec
     JOIN prospect p ON ec.prospect_id = p.id
     JOIN client_integration ci ON ec.client_integration_id = ci.id
     WHERE ec.type = 'Sent'
       AND LOWER(p.company_domain) = LOWER($1)
       AND ci.client_id = $2
     ORDER BY ec.timestamp_email ASC
     LIMIT 1`,
    [domain, clientId]
  );
  return rows[0] || null;
}

// Count emails sent within a date range
export async function countEmailsSentInRange(
  clientId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ count: number; debug: { query: string; params: unknown[]; clientId: string; hasConnection: boolean; error?: string } }> {
  const debug: { query: string; params: unknown[]; clientId: string; hasConnection: boolean; error?: string } = {
    query: '',
    params: [],
    clientId,
    hasConnection: false,
  };
  
  let query = `
    SELECT COUNT(*) as count
    FROM email_conversation ec
    JOIN client_integration ci ON ec.client_integration_id = ci.id
    WHERE ec.type = 'Sent'
      AND ci.client_id = $1
  `;
  
  const params: unknown[] = [clientId];
  let paramIndex = 2;
  
  if (startDate) {
    query += ` AND ec.timestamp_email >= $${paramIndex}::timestamp`;
    params.push(startDate.toISOString());
    paramIndex++;
  }
  
  if (endDate) {
    query += ` AND ec.timestamp_email <= $${paramIndex}::timestamp`;
    params.push(endDate.toISOString());
  }
  
  debug.query = query.replace(/\s+/g, ' ').trim();
  debug.params = params;
  
  try {
    // Test connection first
    await prodQuery('SELECT 1');
    debug.hasConnection = true;
    
    const rows = await prodQuery<{ count: string }>(query, params);
    return { count: parseInt(rows[0]?.count || '0', 10), debug };
  } catch (error) {
    debug.error = (error as Error).message;
    throw new Error(`Email count query failed: ${(error as Error).message}. Debug: ${JSON.stringify(debug)}`);
  }
}

