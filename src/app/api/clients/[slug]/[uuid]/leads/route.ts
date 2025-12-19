// Client Leads API
// Get attributed domains for a client

import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid, getAttributedDomains, getDomainEvents } from '@/db/attribution/queries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;
    const searchParams = req.nextUrl.searchParams;

    const client = await getClientConfigBySlugAndUuid(slug, uuid);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const options: {
      status?: string;
      matchType?: string;
      limit?: number;
      offset?: number;
    } = {};

    // Parse query params
    if (searchParams.has('status')) {
      options.status = searchParams.get('status')!;
    }
    if (searchParams.has('matchType')) {
      options.matchType = searchParams.get('matchType')!;
    }
    if (searchParams.has('limit')) {
      options.limit = parseInt(searchParams.get('limit')!, 10);
    }
    if (searchParams.has('offset')) {
      options.offset = parseInt(searchParams.get('offset')!, 10);
    }

    const domains = await getAttributedDomains(client.id, options);

    // If expanded, get events for each domain
    const expandedDomainId = searchParams.get('expanded');
    let expandedEvents: Array<{
      id: string;
      eventSource: string;
      eventTime: string;
      email: string | null;
      metadata: Record<string, unknown> | null;
    }> = [];

    if (expandedDomainId) {
      const events = await getDomainEvents(expandedDomainId);
      expandedEvents = events.map((e) => ({
        id: e.id,
        eventSource: e.event_source,
        eventTime: e.event_time.toISOString(),
        email: e.email,
        metadata: e.metadata,
      }));
    }

    return NextResponse.json({
      domains: domains.map((d) => ({
        id: d.id,
        domain: d.domain,
        matchType: d.match_type,
        status: d.status,
        hasPositiveReply: d.has_positive_reply,
        hasSignUp: d.has_sign_up,
        hasMeetingBooked: d.has_meeting_booked,
        hasPayingCustomer: d.has_paying_customer,
        isWithinWindow: d.is_within_window,
        firstEmailSentAt: d.first_email_sent_at,
        firstEventAt: d.first_event_at,
        firstAttributedMonth: d.first_attributed_month,
        disputeReason: d.dispute_reason,
        disputeSubmittedAt: d.dispute_submitted_at,
      })),
      expandedEvents,
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: (error as Error).message },
      { status: 500 }
    );
  }
}



