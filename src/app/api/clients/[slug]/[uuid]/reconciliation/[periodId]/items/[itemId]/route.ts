import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// PATCH update a reconciliation line item (monthly revenue submission)
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

    // Verify period belongs to this client and is in OPEN or PENDING_CLIENT status
    const [period] = await attrQuery<{ id: string; status: string }>(`
      SELECT id, status FROM reconciliation_period 
      WHERE id = $1 AND client_config_id = $2
    `, [periodId, client.id]);

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Allow updates for OPEN (active periods) and PENDING_CLIENT status
    if (!['OPEN', 'PENDING_CLIENT'].includes(period.status)) {
      return NextResponse.json(
        { error: 'Cannot modify - reconciliation period is not open for input' },
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
    const { revenue_month_1, revenue_month_2, revenue_month_3, notes } = body;

    // Calculate total revenue from monthly values (use ?? to preserve 0 values)
    const totalRevenue = (revenue_month_1 ?? 0) + (revenue_month_2 ?? 0) + (revenue_month_3 ?? 0);
    
    // Check if user has entered any value (including 0)
    const hasAnyInput = revenue_month_1 !== null || revenue_month_2 !== null || revenue_month_3 !== null;

    // Calculate amount owed based on total revenue
    const amountOwed = hasAnyInput && lineItem.revshare_rate_applied 
      ? totalRevenue * lineItem.revshare_rate_applied 
      : null;

    // Update the line item with monthly revenue breakdown
    // Status is SUBMITTED if any value was entered (including 0)
    // Cast parameters to DECIMAL to avoid PostgreSQL type inference issues with null
    const [updated] = await attrQuery(`
      UPDATE reconciliation_line_item
      SET 
        revenue_month_1 = $1::DECIMAL,
        revenue_month_2 = $2::DECIMAL,
        revenue_month_3 = $3::DECIMAL,
        revenue_submitted = $4::DECIMAL,
        revenue_submitted_at = CASE WHEN $8::BOOLEAN THEN NOW() ELSE NULL END,
        revenue_notes = $5,
        amount_owed = $6::DECIMAL,
        status = CASE WHEN $8::BOOLEAN THEN 'SUBMITTED' ELSE 'PENDING' END,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      revenue_month_1 ?? null, 
      revenue_month_2 ?? null, 
      revenue_month_3 ?? null, 
      hasAnyInput ? totalRevenue : null, 
      notes ?? null, 
      amountOwed, 
      itemId,
      hasAnyInput,
    ]);

    // Update period totals
    await updatePeriodTotals(periodId);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating line item:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update line item', details: errorMessage },
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

