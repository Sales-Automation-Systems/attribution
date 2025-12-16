import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

type ReconciliationStatusType = 'DRAFT' | 'PENDING_CLIENT' | 'CLIENT_SUBMITTED' | 'UNDER_REVIEW' | 'FINALIZED';

// PATCH update reconciliation period status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const { periodId } = await params;
  
  try {
    const body = await req.json();
    const { status, notes } = body as { status: ReconciliationStatusType; notes?: string };

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status transition
    const [currentPeriod] = await attrQuery<{ status: ReconciliationStatusType }>(`
      SELECT status FROM reconciliation_period WHERE id = $1
    `, [periodId]);

    if (!currentPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Define valid transitions
    const validTransitions: Record<ReconciliationStatusType, ReconciliationStatusType[]> = {
      DRAFT: ['PENDING_CLIENT'],
      PENDING_CLIENT: ['CLIENT_SUBMITTED', 'DRAFT'], // Allow reverting to draft
      CLIENT_SUBMITTED: ['UNDER_REVIEW', 'PENDING_CLIENT'], // Allow sending back
      UNDER_REVIEW: ['FINALIZED', 'PENDING_CLIENT'], // Allow sending back for corrections
      FINALIZED: [], // Terminal state
    };

    if (!validTransitions[currentPeriod.status].includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentPeriod.status} to ${status}` },
        { status: 400 }
      );
    }

    // Build update query based on new status
    let updateQuery = `
      UPDATE reconciliation_period
      SET status = $1, updated_at = NOW()
    `;
    const updateParams: (string | null)[] = [status];
    let paramIndex = 2;

    // Set timestamp fields based on status
    if (status === 'PENDING_CLIENT') {
      updateQuery += `, sent_to_client_at = NOW()`;
      if (notes) {
        updateQuery += `, agency_notes = $${paramIndex++}`;
        updateParams.push(notes);
      }
    } else if (status === 'CLIENT_SUBMITTED') {
      updateQuery += `, client_submitted_at = NOW()`;
      if (notes) {
        updateQuery += `, client_notes = $${paramIndex++}`;
        updateParams.push(notes);
      }
    } else if (status === 'FINALIZED') {
      updateQuery += `, finalized_at = NOW(), finalized_by = 'agency'`;
      if (notes) {
        updateQuery += `, agency_notes = $${paramIndex++}`;
        updateParams.push(notes);
      }
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    updateParams.push(periodId);

    const [updated] = await attrQuery(updateQuery, updateParams);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating reconciliation status:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}

