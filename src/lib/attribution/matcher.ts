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
  isWithinAttributionWindow,
  formatAttributionMonth,
  getMatchReason,
  mapEventTypeToSource,
} from './domain-utils';
import type { AttributionEvent, EmailConversation } from '@/db/production/types';
import type { EventSource } from '@/db/attribution/types';

export interface MatchResult {
  matchType: 'HARD_MATCH' | 'SOFT_MATCH' | 'NO_MATCH';
  isWithinWindow: boolean;
  daysSinceEmail: number | null;
  matchedEmail: string | null;
  emailSentAt: Date | null;
  prospectId: string | null;
  matchReason: string;
}

/**
 * Process a single attribution event and find matching emails
 */
export async function processAttributionEvent(
  event: AttributionEvent
): Promise<MatchResult> {
  const clientId = event.client_id;
  const eventEmail = event.email?.toLowerCase() || null;
  const eventDomain = normalizeDomain(event.domain || extractDomain(eventEmail));

  // Get client config
  const clientConfig = await getClientConfigByClientId(clientId);
  if (!clientConfig) {
    return {
      matchType: 'NO_MATCH',
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

  // Step 1: Try hard match (exact email)
  if (eventEmail) {
    match = await findHardMatchEmail(clientId, eventEmail, event.event_time);
    if (match) {
      matchType = 'HARD_MATCH';
    }
  }

  // Step 2: Try soft match (domain) if no hard match and not personal domain
  if (!match && eventDomain && !isPersonal) {
    match = await findSoftMatchEmail(clientId, eventDomain, event.event_time);
    if (match) {
      matchType = 'SOFT_MATCH';
    }
  }

  // Calculate results
  let daysSinceEmail: number | null = null;
  let isWithinWindow = false;
  let matchedEmail: string | null = null;
  let emailSentAt: Date | null = null;
  let prospectId: string | null = null;

  if (match) {
    emailSentAt = match.timestamp_email;
    prospectId = match.prospect_id;
    daysSinceEmail = daysBetween(match.timestamp_email, event.event_time);
    isWithinWindow = daysSinceEmail <= 31;

    // Get the actual email that was matched
    // For hard match, it's the event email; for soft match, we need to look it up
    if (matchType === 'HARD_MATCH') {
      matchedEmail = eventEmail;
    } else {
      // For soft match, get the email we sent to
      const firstEmail = await getFirstEmailSentToDomain(clientId, eventDomain!);
      matchedEmail = firstEmail ? eventEmail : null; // Will be looked up via prospect
    }
  }

  const matchReason = getMatchReason(
    eventEmail,
    eventDomain,
    matchedEmail,
    emailSentAt,
    event.event_time,
    isPersonal
  );

  // Store the results
  if (eventDomain) {
    // Get first email sent to this domain for the domain record
    let firstEmailSentAt: Date | null = null;
    if (eventEmail) {
      const firstEmailToAddress = await getFirstEmailSentToAddress(clientId, eventEmail);
      firstEmailSentAt = firstEmailToAddress?.timestamp_email || null;
    }
    if (!firstEmailSentAt && eventDomain) {
      const firstEmailToDomain = await getFirstEmailSentToDomain(clientId, eventDomain);
      firstEmailSentAt = firstEmailToDomain?.timestamp_email || null;
    }

    // Upsert attributed domain
    const attributedDomain = await upsertAttributedDomain({
      client_config_id: clientConfig.id,
      domain: eventDomain,
      first_email_sent_at: firstEmailSentAt || undefined,
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
        email: eventEmail || undefined,
        source_id: event.id,
        source_table: 'attribution_event',
        metadata: event.metadata || undefined,
      });
    }

    // Create attribution match record for audit
    await createAttributionMatch({
      client_config_id: clientConfig.id,
      attribution_event_id: event.id,
      attributed_domain_id: attributedDomain.id,
      prospect_id: prospectId || undefined,
      event_type: event.event_type,
      event_time: event.event_time,
      event_email: eventEmail || undefined,
      event_domain: eventDomain,
      match_type: matchType,
      matched_email: matchedEmail || undefined,
      email_sent_at: emailSentAt || undefined,
      days_since_email: daysSinceEmail || undefined,
      is_within_window: isWithinWindow,
      match_reason: matchReason,
    });
  }

  return {
    matchType,
    isWithinWindow,
    daysSinceEmail,
    matchedEmail,
    emailSentAt,
    prospectId,
    matchReason,
  };
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
    const eventSource: EventSource =
      email.type === 'Sent' ? 'EMAIL_SENT' : 'EMAIL_RECEIVED';

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

