import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// GET reconciliation period details for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; periodId: string }> }
) {
  const { slug, uuid, periodId } = await params;
  
  try {
    // Verify client access
    const [client] = await attrQuery<{ id: string }>(`
      SELECT id FROM client_config WHERE slug = $1 AND access_uuid = $2
    `, [slug, uuid]);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Verify period belongs to this client
    const [period] = await attrQuery<{ id: string }>(`
      SELECT id FROM reconciliation_period 
      WHERE id = $1 AND client_config_id = $2
    `, [periodId, client.id]);

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Get line items
    const lineItems = await attrQuery(`
      SELECT *
      FROM reconciliation_line_item
      WHERE reconciliation_period_id = $1
      ORDER BY domain
    `, [periodId]);

    return NextResponse.json({ lineItems });
  } catch (error) {
    console.error('Error fetching reconciliation period:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation data' },
      { status: 500 }
    );
  }
}




