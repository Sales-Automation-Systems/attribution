// Domains API - Fetch attributed domains with server-side filtering
import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid, getAttributedDomains, getAttributedDomainsCount } from '@/db/attribution/queries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;
    const { searchParams } = new URL(req.url);
    
    const client = await getClientConfigBySlugAndUuid(slug, uuid);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Parse filter params
    const status = searchParams.get('status');
    const events = searchParams.get('events');
    const search = searchParams.get('search');
    const focus = searchParams.get('focus') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build options for query
    const options: {
      status?: string[];
      events?: string[];
      search?: string;
      focusView?: boolean;
      limit: number;
      offset: number;
    } = {
      limit,
      offset,
    };

    // Parse status filter (comma-separated)
    if (status) {
      options.status = status.split(',').filter(s => 
        ['attributed', 'outside_window', 'unattributed', 'disputed', 'client_attributed'].includes(s)
      );
    }

    // Parse events filter (comma-separated)
    if (events) {
      options.events = events.split(',').filter(e => 
        ['reply', 'signup', 'meeting', 'paying'].includes(e)
      );
    }

    // Search filter
    if (search) {
      options.search = search;
    }

    // Focus view
    if (focus) {
      options.focusView = true;
    }

    // Fetch domains with filters
    const domains = await getAttributedDomains(client.id, options);
    
    // Get total count (without filters for now - we could add filtered count later)
    const totalCount = await getAttributedDomainsCount(client.id);

    // Serialize dates for client
    const serializedDomains = domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      first_email_sent_at: d.first_email_sent_at ? new Date(d.first_email_sent_at).toISOString() : null,
      first_event_at: d.first_event_at ? new Date(d.first_event_at).toISOString() : null,
      last_event_at: d.last_event_at ? new Date(d.last_event_at).toISOString() : null,
      has_positive_reply: d.has_positive_reply,
      has_sign_up: d.has_sign_up,
      has_meeting_booked: d.has_meeting_booked,
      has_paying_customer: d.has_paying_customer,
      is_within_window: d.is_within_window,
      match_type: d.match_type,
      status: d.status,
    }));

    return NextResponse.json({
      domains: serializedDomains,
      totalCount,
      hasMore: offset + domains.length < totalCount,
    });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch domains', details: (error as Error).message },
      { status: 500 }
    );
  }
}

