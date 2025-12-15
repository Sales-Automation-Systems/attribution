import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// POST create a dispute on a line item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string; itemId: string }> }
) {
  const { periodId, itemId } = await params;
  
  try {
    const body = await req.json();
    const { reason, submittedBy } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 });
    }

    // Verify line item exists and belongs to period
    const [lineItem] = await attrQuery<{ id: string; status: string }>(`
      SELECT id, status 
      FROM reconciliation_line_item 
      WHERE id = $1 AND reconciliation_period_id = $2
    `, [itemId, periodId]);

    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    // Update line item to disputed status
    const [updated] = await attrQuery(`
      UPDATE reconciliation_line_item
      SET 
        status = 'DISPUTED',
        dispute_reason = $1,
        dispute_submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [reason, itemId]);

    // Optionally create a task for tracking
    await attrQuery(`
      INSERT INTO task (
        client_config_id, 
        type, 
        status, 
        title, 
        description, 
        submitted_by
      )
      SELECT 
        rp.client_config_id,
        'RECONCILIATION',
        'OPEN',
        $1,
        $2,
        $3
      FROM reconciliation_period rp
      WHERE rp.id = $4
    `, [
      `Dispute: ${updated.domain}`,
      `Line item disputed in reconciliation period.\n\nReason: ${reason}`,
      submittedBy || 'agency',
      periodId,
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error creating dispute:', error);
    return NextResponse.json(
      { error: 'Failed to create dispute' },
      { status: 500 }
    );
  }
}

// PATCH resolve a dispute
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string; itemId: string }> }
) {
  const { periodId, itemId } = await params;
  
  try {
    const body = await req.json();
    const { resolution, newStatus, resolvedBy } = body;

    if (!resolution || !newStatus) {
      return NextResponse.json(
        { error: 'Resolution notes and new status are required' },
        { status: 400 }
      );
    }

    // Update line item
    const [updated] = await attrQuery(`
      UPDATE reconciliation_line_item
      SET 
        status = $1,
        resolution_notes = $2,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = $3 AND reconciliation_period_id = $4
      RETURNING *
    `, [newStatus, resolution, itemId, periodId]);

    if (!updated) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return NextResponse.json(
      { error: 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}

