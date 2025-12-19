import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid, getDomainEvents, getAttributedDomainById } from '@/db/attribution/queries';

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

    // Verify domain belongs to this client
    const domain = await getAttributedDomainById(domainId);
    if (!domain || domain.client_config_id !== client.id) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    // Get events for this domain
    const events = await getDomainEvents(domainId);

    return NextResponse.json({ events, domain });
  } catch (error) {
    console.error('Error fetching domain events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}



