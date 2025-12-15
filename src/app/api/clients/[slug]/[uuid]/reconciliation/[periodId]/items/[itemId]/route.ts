import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// PATCH update a reconciliation line item (revenue submission)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; periodId: string; itemId: string }> }
) {
  const { slug, uuid, periodId, itemId } = await params;
  
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
        { error: 'Cannot modify - reconciliation is not in pending status' },
        { status: 400 }
      );
    }

    // Get the line item and its rate
    const [lineItem] = await attrQuery<{ revshare_rate_applied: number | null }>(`
      SELECT revshare_rate_applied 
      FROM reconciliation_line_item 
      WHERE id = $1 AND reconciliation_period_id = $2
    `, [itemId, periodId]);

    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    const body = await req.json();
    const { revenue, notes } = body;

    // Calculate amount owed
    const amountOwed = revenue && lineItem.revshare_rate_applied 
      ? revenue * lineItem.revshare_rate_applied 
      : null;

    // Update the line item
    const [updated] = await attrQuery(`
      UPDATE reconciliation_line_item
      SET 
        revenue_submitted = $1,
        revenue_submitted_at = CASE WHEN $1 IS NOT NULL THEN NOW() ELSE NULL END,
        revenue_notes = $2,
        amount_owed = $3,
        status = CASE WHEN $1 IS NOT NULL THEN 'SUBMITTED' ELSE 'PENDING' END,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [revenue, notes, amountOwed, itemId]);

    // Update period totals
    await updatePeriodTotals(periodId);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating line item:', error);
    return NextResponse.json(
      { error: 'Failed to update line item' },
      { status: 500 }
    );
  }
}

async function updatePeriodTotals(periodId: string) {
  await attrQuery(`
    UPDATE reconciliation_period
    SET 
      total_revenue_submitted = COALESCE((
        SELECT SUM(revenue_submitted) 
        FROM reconciliation_line_item 
        WHERE reconciliation_period_id = $1
      ), 0),
      total_amount_owed = COALESCE((
        SELECT SUM(amount_owed) 
        FROM reconciliation_line_item 
        WHERE reconciliation_period_id = $1
      ), 0),
      updated_at = NOW()
    WHERE id = $1
  `, [periodId]);
}

