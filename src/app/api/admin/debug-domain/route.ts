import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// Debug endpoint to check domain data
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'domain query param required' }, { status: 400 });
  }
  
  // Find the attributed_domain
  const [domainData] = await attrQuery<{
    id: string;
    domain: string;
    client_config_id: string;
    status: string;
    has_paying_customer: boolean;
    first_event_at: Date | null;
  }>(`
    SELECT id, domain, client_config_id, status, has_paying_customer, first_event_at
    FROM attributed_domain
    WHERE domain = $1
  `, [domain]);
  
  if (!domainData) {
    return NextResponse.json({ error: 'Domain not found', domain });
  }
  
  // Find all domain_events for this domain
  const events = await attrQuery<{
    id: string;
    event_source: string;
    event_time: Date | null;
    created_at: Date;
  }>(`
    SELECT id, event_source, event_time, created_at
    FROM domain_event
    WHERE attributed_domain_id = $1
    ORDER BY created_at DESC
  `, [domainData.id]);
  
  return NextResponse.json({
    domain: domainData,
    events,
  });
}

