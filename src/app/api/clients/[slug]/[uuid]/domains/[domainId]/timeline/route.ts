import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid, getAttributedDomainById } from '@/db/attribution/queries';
import { attrQuery } from '@/db';

interface TimelineEvent {
  id: string;
  type: 'EMAIL_SENT' | 'POSITIVE_REPLY' | 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER' | 'STATUS_CHANGE';
  date: string;
  email?: string;
  subject?: string;
  campaignName?: string;
  metadata?: Record<string, unknown>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; domainId: string }> }
) {
  // Server-side log - write to console for Vercel logs
  console.log('[DEBUG:timeline-api] Request received');
  try {
    const { slug, uuid, domainId } = await params;
    console.log('[DEBUG:timeline-api] Params:', { slug, uuid, domainId });

    // Verify client access
    const client = await getClientConfigBySlugAndUuid(slug, uuid);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get domain info with all details
    const domainResult = await attrQuery<{
      id: string;
      domain: string;
      client_config_id: string;
      first_email_sent_at: Date | null;
      first_event_at: Date | null;
      has_positive_reply: boolean;
      has_sign_up: boolean;
      has_meeting_booked: boolean;
      has_paying_customer: boolean;
      is_within_window: boolean;
      match_type: string;
      matched_email: string | null;
      matched_emails: string[] | null;
      status: string;
      created_at: Date;
    }>(`
      SELECT id, domain, client_config_id, first_email_sent_at, first_event_at,
             has_positive_reply, has_sign_up, has_meeting_booked, has_paying_customer,
             is_within_window, match_type, matched_email, matched_emails, status, created_at
      FROM attributed_domain
      WHERE id = $1
    `, [domainId]);

    if (!domainResult.length || domainResult[0].client_config_id !== client.id) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    const domain = domainResult[0];
    const timeline: TimelineEvent[] = [];

    // Check for detailed events stored in domain_event table
    const detailedEvents = await attrQuery<{
      id: string;
      event_source: string;
      event_time: Date;
      email: string | null;
      metadata: Record<string, unknown> | null;
    }>(`
      SELECT id, event_source, event_time, email, metadata
      FROM domain_event
      WHERE attributed_domain_id = $1
      ORDER BY event_time ASC
    `, [domainId]);

    // Track if we found a STATUS_CHANGE for initial attribution
    let hasInitialAttributionEvent = false;

    if (detailedEvents.length > 0) {
      // Use detailed events from domain_event table
      for (const event of detailedEvents) {
        let eventType: TimelineEvent['type'];
        switch (event.event_source.toUpperCase()) {
          case 'EMAIL_SENT':
          case 'EMAIL':
            eventType = 'EMAIL_SENT';
            break;
          case 'POSITIVE_REPLY':
          case 'REPLY':
            eventType = 'POSITIVE_REPLY';
            break;
          case 'SIGN_UP':
          case 'SIGNUP':
            eventType = 'SIGN_UP';
            break;
          case 'MEETING_BOOKED':
          case 'MEETING':
            eventType = 'MEETING_BOOKED';
            break;
          case 'PAYING_CUSTOMER':
          case 'PAYING':
            eventType = 'PAYING_CUSTOMER';
            break;
          case 'STATUS_CHANGE':
            eventType = 'STATUS_CHANGE';
            // Check if this is an attribution-related status change
            const meta = event.metadata || {};
            if (meta.newStatus === 'ATTRIBUTED' || meta.action === 'SYSTEM_UPDATE') {
              hasInitialAttributionEvent = true;
            }
            break;
          default:
            continue;
        }

        timeline.push({
          id: event.id,
          type: eventType,
          date: event.event_time.toISOString(),
          email: event.email ?? undefined,
          metadata: event.metadata ?? undefined,
        });
      }
    } else {
      // Fall back to basic timeline from attributed_domain flags
      // Add first email event if we have the date
      if (domain.first_email_sent_at) {
        timeline.push({
          id: `email-first-${domain.id}`,
          type: 'EMAIL_SENT',
          date: domain.first_email_sent_at.toISOString(),
          metadata: { note: 'First email sent to this domain' },
        });
      }

      // Add first event if we have it (could be reply, signup, meeting, or paying)
      if (domain.first_event_at) {
        // Determine what type of event it was based on flags
        if (domain.has_positive_reply) {
          timeline.push({
            id: `event-reply-${domain.id}`,
            type: 'POSITIVE_REPLY',
            date: domain.first_event_at.toISOString(),
            metadata: { note: 'First positive reply from this domain' },
          });
        }
        if (domain.has_sign_up) {
          timeline.push({
            id: `event-signup-${domain.id}`,
            type: 'SIGN_UP',
            date: domain.first_event_at.toISOString(),
            metadata: { note: 'Sign-up event recorded' },
          });
        }
        if (domain.has_meeting_booked) {
          timeline.push({
            id: `event-meeting-${domain.id}`,
            type: 'MEETING_BOOKED',
            date: domain.first_event_at.toISOString(),
            metadata: { note: 'Meeting booked' },
          });
        }
        if (domain.has_paying_customer) {
          timeline.push({
            id: `event-paying-${domain.id}`,
            type: 'PAYING_CUSTOMER',
            date: domain.first_event_at.toISOString(),
            metadata: { note: 'Became paying customer' },
          });
        }
      }
    }

    // Add synthetic "Attribution Determined" event for attributed domains
    // This shows when the system first determined attribution (based on first success event)
    const isAttributed = ['ATTRIBUTED', 'CLIENT_PROMOTED', 'CONFIRMED'].includes(domain.status);
    const isDisputed = ['DISPUTED', 'DISPUTE_PENDING'].includes(domain.status);
    
    if ((isAttributed || isDisputed) && !hasInitialAttributionEvent && domain.first_event_at) {
      // Add a synthetic status change showing when attribution was determined
      // Use first_event_at as that's when the success event happened
      timeline.push({
        id: `synthetic-attribution-${domain.id}`,
        type: 'STATUS_CHANGE',
        date: domain.first_event_at.toISOString(),
        metadata: {
          action: 'SYSTEM_UPDATE',
          oldStatus: null,
          newStatus: 'ATTRIBUTED',
          reason: 'Attribution determined by system based on email match and success event',
          changedBy: 'System',
          synthetic: true, // Flag to indicate this was generated, not logged
        },
      });
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ 
      timeline,
      hasDetailedEvents: detailedEvents.length > 0,
      domain: {
        name: domain.domain,
        matchType: domain.match_type,
        matchedEmail: domain.matched_email, // Legacy: first focused contact
        matchedEmails: domain.matched_emails || [], // All focused contacts
        isWithinWindow: domain.is_within_window,
        status: domain.status,
      }
    });
  } catch (error) {
    console.error('Error fetching domain timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline', details: (error as Error).message },
      { status: 500 }
    );
  }
}
