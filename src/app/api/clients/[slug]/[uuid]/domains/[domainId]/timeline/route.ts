import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid, getAttributedDomainById } from '@/db/attribution/queries';
import { prodQuery } from '@/db';

interface TimelineEvent {
  id: string;
  type: 'EMAIL_SENT' | 'POSITIVE_REPLY' | 'SIGN_UP' | 'MEETING_BOOKED' | 'PAYING_CUSTOMER';
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
  try {
    const { slug, uuid, domainId } = await params;

    // Verify client access
    const client = await getClientConfigBySlugAndUuid(slug, uuid);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get domain info
    const domain = await getAttributedDomainById(domainId);
    if (!domain || domain.client_config_id !== client.id) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    const domainName = domain.domain.toLowerCase();
    const timeline: TimelineEvent[] = [];

    // 1. Get all emails sent to this domain
    const emailsSent = await prodQuery<{
      id: string;
      timestamp_email: Date;
      lead_email: string;
      subject: string;
      campaign_name: string | null;
    }>(`
      SELECT DISTINCT ON (ec.timestamp_email, p.lead_email)
        ec.id,
        ec.timestamp_email,
        p.lead_email,
        ec.subject,
        c.name as campaign_name
      FROM email_conversation ec
      JOIN prospect p ON ec.prospect_id = p.id
      JOIN client_integration ci ON ec.client_integration_id = ci.id
      LEFT JOIN campaign c ON p.campaign_id = c.id
      WHERE ec.type = 'Sent'
        AND ci.client_id = $1
        AND LOWER(p.company_domain) = $2
      ORDER BY ec.timestamp_email, p.lead_email
      LIMIT 50
    `, [client.client_id, domainName]);

    for (const email of emailsSent) {
      timeline.push({
        id: `email-${email.id}`,
        type: 'EMAIL_SENT',
        date: email.timestamp_email.toISOString(),
        email: email.lead_email,
        subject: email.subject,
        campaignName: email.campaign_name ?? undefined,
      });
    }

    // 2. Get positive replies from this domain
    const positiveReplies = await prodQuery<{
      id: string;
      lead_email: string;
      last_interaction_time: Date | null;
      category_name: string;
    }>(`
      SELECT p.id, p.lead_email, p.last_interaction_time, lc.name as category_name
      FROM prospect p
      JOIN lead_category lc ON p.lead_category_id = lc.id
      JOIN client_integration ci ON p.client_integration_id = ci.id
      WHERE lc.sentiment = 'POSITIVE'
        AND ci.client_id = $1
        AND LOWER(p.company_domain) = $2
      ORDER BY p.last_interaction_time
    `, [client.client_id, domainName]);

    for (const reply of positiveReplies) {
      if (reply.last_interaction_time) {
        timeline.push({
          id: `reply-${reply.id}`,
          type: 'POSITIVE_REPLY',
          date: reply.last_interaction_time.toISOString(),
          email: reply.lead_email,
          metadata: { category: reply.category_name },
        });
      }
    }

    // 3. Get attribution events (sign-ups, meetings, paying)
    const attrEvents = await prodQuery<{
      id: string;
      event_type: string;
      event_time: Date;
      email: string | null;
      metadata: Record<string, unknown> | null;
    }>(`
      SELECT ae.id, ae.event_type, ae.event_time, ae.email, ae.metadata
      FROM attribution_event ae
      JOIN client_integration ci ON ae.client_integration_id = ci.id
      WHERE ci.client_id = $1
        AND LOWER(ae.domain) = $2
      ORDER BY ae.event_time
    `, [client.client_id, domainName]);

    for (const event of attrEvents) {
      let eventType: TimelineEvent['type'];
      switch (event.event_type) {
        case 'sign_up':
          eventType = 'SIGN_UP';
          break;
        case 'meeting_booked':
          eventType = 'MEETING_BOOKED';
          break;
        case 'paying_customer':
          eventType = 'PAYING_CUSTOMER';
          break;
        default:
          continue;
      }

      timeline.push({
        id: `event-${event.id}`,
        type: eventType,
        date: event.event_time.toISOString(),
        email: event.email ?? undefined,
        metadata: event.metadata ?? undefined,
      });
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ 
      timeline,
      domain: {
        name: domain.domain,
        matchType: domain.match_type,
        isWithinWindow: domain.is_within_window,
      }
    });
  } catch (error) {
    console.error('Error fetching domain timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

