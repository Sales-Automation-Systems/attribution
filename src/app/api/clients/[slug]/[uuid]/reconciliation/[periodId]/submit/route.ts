import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// POST submit reconciliation
export async function POST(
  req: NextRequest,
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

    // Verify period belongs to this client and is in PENDING_CLIENT status
    const [period] = await attrQuery<{ id: string; status: string }>(`
      SELECT id, status FROM reconciliation_period 
      WHERE id = $1 AND client_config_id = $2
    `, [periodId, client.id]);

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    if (period.status !== 'PENDING_CLIENT') {
      return NextResponse.json(
        { error: 'Cannot submit - reconciliation is not in pending status' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { notes } = body;

    // Update period status
    const [updated] = await attrQuery(`
      UPDATE reconciliation_period
      SET 
        status = 'CLIENT_SUBMITTED',
        client_submitted_at = NOW(),
        client_notes = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [notes || null, periodId]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error submitting reconciliation:', error);
    return NextResponse.json(
      { error: 'Failed to submit reconciliation' },
      { status: 500 }
    );
  }
}

