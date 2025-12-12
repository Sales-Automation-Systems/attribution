// Attribution Matching Engine
// Core logic for matching attribution events to emails

import {
  findHardMatchEmail,
  findSoftMatchEmail,
  getFirstEmailSentToAddress,
  getFirstEmailSentToDomain,
} from '@/db/production/queries';
import {
  upsertAttributedDomain,
  createDomainEvent,
  createAttributionMatch,
  getClientConfigByClientId,
  isPersonalEmailDomain,
} from '@/db/attribution/queries';
import {
  normalizeDomain,
  extractDomain,
  daysBetween,
  formatAttributionMonth,
  mapEventTypeToSource,
} from './domain-utils';
import type { AttributionEvent, EmailConversation } from '@/db/production/types';

// Three buckets for attribution status
export type AttributionStatus = 'ATTRIBUTED' | 'OUTSIDE_WINDOW' | 'NO_MATCH';

export interface MatchResult {
  matchType: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH';
  attributionStatus: AttributionStatus;
  isWithinWindow: boolean;
  daysSinceEmail: number | null;
  matchedEmail: string | null;
  emailSentAt: Date | null;
  prospectId: string | null;
  matchReason: string;
}

/**
 * Process a single attribution event and find matching emails
 * 
 * Logic:
 * 1. Find ANY email we sent to this person/domain BEFORE the event (no time limit)
 * 2. If found, check if within 31 days:
 *    - Within 31 days = ATTRIBUTED
 *    - Outside 31 days = OUTSIDE_WINDOW
 * 3. If no email found = NO_MATCH
 */
export async function processAttributionEvent(
  event: AttributionEvent
): Promise<MatchResult> {
  const clientId = event.client_id;
  const eventEmail = event.email?.toLowerCase() ?? null;
  const eventDomain = normalizeDomain(event.domain ?? extractDomain(eventEmail));

  // Get client config
  const clientConfig = await getClientConfigByClientId(clientId);
  if (!clientConfig) {
    return {
      matchType: 'NO_MATCH',
      attributionStatus: 'NO_MATCH',
      isWithinWindow: false,
      daysSinceEmail: null,
      matchedEmail: null,
      emailSentAt: null,
      prospectId: null,
      matchReason: 'Client not configured in attribution system',
    };
  }

  // Check if domain is a personal email domain
  const isPersonal = eventDomain ? await isPersonalEmailDomain(eventDomain) : false;

  let match: EmailConversation | null = null;
  let matchType: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH' = 'NO_MATCH';
  let matchedProspectEmail: string | null = null;

  // Step 1: Try hard match (exact email) - find ANY email sent before event
  if (eventEmail) {
    match = await findHardMatchEmail(clientId, eventEmail, event.event_time);
    if (match) {
      matchType = 'HARD_MATCH';
      matchedProspectEmail = eventEmail;
    }
  }

  // Step 2: If no hard match, try soft match (domain) - only for non-personal domains
  if (!match && eventDomain && !isPersonal) {
    match = await findSoftMatchEmail(clientId, eventDomain, event.event_time);
    if (match) {
      matchType = 'SOFT_MATCH';
      // For soft match, we need to get the email we actually sent to
      const firstEmail = await getFirstEmailSentToDomain(clientId, eventDomain);
      if (firstEmail) {
        // We'll store the domain, the actual matched email comes from the prospect
        matchedProspectEmail = eventDomain; // Store domain for soft matches
      }
    }
  }

  // Step 3: Calculate attribution status
  let daysSinceEmail: number | null = null;
  let isWithinWindow = false;
  let attributionStatus: AttributionStatus = 'NO_MATCH';
  let emailSentAt: Date | null = null;
  let prospectId: string | null = null;

  if (match) {
    emailSentAt = match.timestamp_email;
    prospectId = match.prospect_id;
    daysSinceEmail = daysBetween(match.timestamp_email, event.event_time);
    
    // Classify into buckets
    if (daysSinceEmail <= 31) {
      isWithinWindow = true;
      attributionStatus = 'ATTRIBUTED';
    } else {
      isWithinWindow = false;
      attributionStatus = 'OUTSIDE_WINDOW';
    }
  }

  // Build match reason for audit trail
  const matchReason = buildMatchReason(
    eventEmail,
    eventDomain,
    matchedProspectEmail,
    emailSentAt,
    event.event_time,
    daysSinceEmail,
    isPersonal,
    matchType,
    attributionStatus
  );

  // Step 4: Store results grouped by domain
  if (eventDomain) {
    // Get first email sent to this domain for the domain record
    let firstEmailSentAt: Date | null = null;
    if (eventEmail) {
      const firstEmailToAddress = await getFirstEmailSentToAddress(clientId, eventEmail);
      firstEmailSentAt = firstEmailToAddress?.timestamp_email ?? null;
    }
    if (!firstEmailSentAt && eventDomain) {
      const firstEmailToDomain = await getFirstEmailSentToDomain(clientId, eventDomain);
      firstEmailSentAt = firstEmailToDomain?.timestamp_email ?? null;
    }

    // Upsert attributed domain (groups all events for this domain)
    const attributedDomain = await upsertAttributedDomain({
      client_config_id: clientConfig.id,
      domain: eventDomain,
      first_email_sent_at: firstEmailSentAt ?? undefined,
      first_event_at: event.event_time,
      first_attributed_month: formatAttributionMonth(event.event_time),
      has_sign_up: event.event_type === 'sign_up',
      has_meeting_booked: event.event_type === 'meeting_booked',
      has_paying_customer: event.event_type === 'paying_customer',
      is_within_window: isWithinWindow,
      match_type: matchType,
    });

    // Create domain event for timeline
    const eventSource = mapEventTypeToSource(event.event_type);
    if (eventSource) {
      await createDomainEvent({
        attributed_domain_id: attributedDomain.id,
        event_source: eventSource,
        event_time: event.event_time,
        email: eventEmail ?? undefined,
        source_id: event.id,
        source_table: 'attribution_event',
        metadata: event.metadata ?? undefined,
      });
    }

    // Create attribution match record for audit
    await createAttributionMatch({
      client_config_id: clientConfig.id,
      attribution_event_id: event.id,
      attributed_domain_id: attributedDomain.id,
      prospect_id: prospectId ?? undefined,
      event_type: event.event_type,
      event_time: event.event_time,
      event_email: eventEmail ?? undefined,
      event_domain: eventDomain,
      match_type: matchType,
      matched_email: matchedProspectEmail ?? undefined,
      email_sent_at: emailSentAt ?? undefined,
      days_since_email: daysSinceEmail ?? undefined,
      is_within_window: isWithinWindow,
      match_reason: matchReason,
    });
  }

  return {
    matchType,
    attributionStatus,
    isWithinWindow,
    daysSinceEmail,
    matchedEmail: matchedProspectEmail,
    emailSentAt,
    prospectId,
    matchReason,
  };
}

/**
 * Build a human-readable match reason for audit trail
 */
function buildMatchReason(
  eventEmail: string | null,
  eventDomain: string | null,
  matchedEmail: string | null,
  emailSentAt: Date | null,
  eventTime: Date,
  daysSinceEmail: number | null,
  isPersonalDomain: boolean,
  matchType: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH',
  attributionStatus: AttributionStatus
): string {
  if (matchType === 'NO_MATCH') {
    if (isPersonalDomain) {
      return `No match: ${eventDomain} is a personal email domain (soft matching disabled)`;
    }
    return `No match: No emails found sent to ${eventEmail ?? eventDomain} before the event`;
  }

  const matchTypeLabel = matchType === 'HARD_MATCH' ? 'Hard match (exact email)' : 'Soft match (same domain)';
  
  if (attributionStatus === 'ATTRIBUTED') {
    return `${matchTypeLabel}: Email sent to ${matchedEmail} on ${emailSentAt?.toISOString().split('T')[0]}, ${daysSinceEmail} days before event. ATTRIBUTED (within 31-day window)`;
  } else {
    return `${matchTypeLabel}: Email sent to ${matchedEmail} on ${emailSentAt?.toISOString().split('T')[0]}, ${daysSinceEmail} days before event. OUTSIDE WINDOW (>${31} days)`;
  }
}

/**
 * Add email events to a domain's timeline (for display purposes)
 */
export async function addEmailEventsToTimeline(
  clientConfigId: string,
  attributedDomainId: string,
  emails: EmailConversation[]
): Promise<void> {
  for (const email of emails) {
    const eventSource = email.type === 'Sent' ? 'EMAIL_SENT' : 'EMAIL_RECEIVED';

    await createDomainEvent({
      attributed_domain_id: attributedDomainId,
      event_source: eventSource,
      event_time: email.timestamp_email,
      source_id: email.id,
      source_table: 'email_conversation',
      metadata: {
        subject: email.subject,
        prospect_id: email.prospect_id,
      },
    });
  }
}
