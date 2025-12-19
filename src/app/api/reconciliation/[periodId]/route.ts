import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// GET reconciliation period with line items
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const { periodId } = await params;
  
  try {
    // Fetch period with client info
    const [period] = await attrQuery<{
      id: string;
      client_config_id: string;
      client_name: string;
      client_slug: string;
      period_name: string;
      start_date: string;
      end_date: string;
      status: string;
      created_by: string | null;
      created_at: string;
      sent_to_client_at: string | null;
      client_submitted_at: string | null;
      finalized_at: string | null;
      finalized_by: string | null;
      total_signups: number;
      total_meetings: number;
      total_paying_customers: number;
      total_revenue_submitted: number;
      total_amount_owed: number;
      agency_notes: string | null;
      client_notes: string | null;
      billing_model: string;
      rev_share_rate: number;
      revshare_plg: number | null;
      revshare_sales: number | null;
      fee_per_signup: number | null;
      fee_per_meeting: number | null;
    }>(`
      SELECT 
        rp.*,
        cc.client_name,
        cc.slug as client_slug,
        COALESCE(cc.billing_model, 'flat_revshare') as billing_model,
        cc.rev_share_rate,
        cc.revshare_plg,
        cc.revshare_sales,
        cc.fee_per_signup,
        cc.fee_per_meeting
      FROM reconciliation_period rp
      JOIN client_config cc ON cc.id = rp.client_config_id
      WHERE rp.id = $1
    `, [periodId]);

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Fetch line items
    const lineItems = await attrQuery(`
      SELECT *
      FROM reconciliation_line_item
      WHERE reconciliation_period_id = $1
      ORDER BY domain
    `, [periodId]);

    return NextResponse.json({ period, lineItems });
  } catch (error) {
    console.error('Error fetching reconciliation period:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation period' },
      { status: 500 }
    );
  }
}

// DELETE reconciliation period
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const { periodId } = await params;
  
  try {
    // Check status - only allow deleting DRAFT periods
    const [period] = await attrQuery<{ status: string }>(`
      SELECT status FROM reconciliation_period WHERE id = $1
    `, [periodId]);

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    if (period.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete periods in DRAFT status' },
        { status: 400 }
      );
    }

    // Delete line items first (cascade should handle this, but being explicit)
    await attrQuery(`DELETE FROM reconciliation_line_item WHERE reconciliation_period_id = $1`, [periodId]);
    await attrQuery(`DELETE FROM reconciliation_period WHERE id = $1`, [periodId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reconciliation period:', error);
    return NextResponse.json(
      { error: 'Failed to delete reconciliation period' },
      { status: 500 }
    );
  }
}



