import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// GET reconciliation periods for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  const { slug, uuid } = await params;
  
  try {
    // Verify client access
    const [client] = await attrQuery<{ id: string }>(`
      SELECT id FROM client_config WHERE slug = $1 AND access_uuid = $2
    `, [slug, uuid]);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all periods for this client with billing settings
    const periods = await attrQuery(`
      SELECT 
        rp.*,
        COALESCE(cc.billing_model, 'flat_revshare') as billing_model,
        COALESCE(cc.billing_cycle, 'monthly') as billing_cycle,
        cc.rev_share_rate,
        cc.revshare_plg,
        cc.revshare_sales,
        cc.fee_per_signup,
        cc.fee_per_meeting
      FROM reconciliation_period rp
      JOIN client_config cc ON cc.id = rp.client_config_id
      WHERE rp.client_config_id = $1
      ORDER BY rp.start_date DESC
    `, [client.id]);

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Error fetching client reconciliation periods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation data' },
      { status: 500 }
    );
  }
}

