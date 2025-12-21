import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/clients/[slug]/[uuid]/reconciliation/[periodId]/add-domain
 * 
 * Manually add a domain to a reconciliation period.
 * This creates a line item directly in the reconciliation_line_item table.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string; periodId: string }> }
) {
  try {
    const { slug, uuid, periodId } = await params;
    const body = await request.json();
    const { domainId, billingStartDate } = body;

    // Validate required fields
    if (!domainId) {
      return NextResponse.json({ error: 'Domain ID is required' }, { status: 400 });
    }
    if (!billingStartDate) {
      return NextResponse.json({ error: 'Billing start date is required' }, { status: 400 });
    }

    // Verify client exists
    const clientResult = await attrPool.query(
      `SELECT id FROM client_config WHERE slug = $1 AND access_uuid = $2`,
      [slug, uuid]
    );

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientConfigId = clientResult.rows[0].id;

    // Verify period exists and belongs to this client
    const periodResult = await attrPool.query(
      `SELECT rp.id, rp.status, cc.rev_share_rate, cc.revshare_plg, cc.revshare_sales, 
              cc.fee_per_signup, cc.fee_per_meeting, cc.billing_model
       FROM reconciliation_period rp
       JOIN client_config cc ON rp.client_config_id = cc.id
       WHERE rp.id = $1 AND rp.client_config_id = $2`,
      [periodId, clientConfigId]
    );

    if (periodResult.rows.length === 0) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    const period = periodResult.rows[0];

    // Check period status - can only add to OPEN periods
    if (!['OPEN', 'PENDING_CLIENT'].includes(period.status)) {
      return NextResponse.json(
        { error: 'Can only add domains to OPEN or PENDING_CLIENT periods' },
        { status: 400 }
      );
    }

    // Get domain details
    const domainResult = await attrPool.query(
      `SELECT id, domain, has_sign_up, has_meeting_booked, has_paying_customer, status
       FROM attributed_domain
       WHERE id = $1 AND client_config_id = $2`,
      [domainId, clientConfigId]
    );

    if (domainResult.rows.length === 0) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    const domain = domainResult.rows[0];

    // Check if line item already exists for this domain in this period
    const existingLineItem = await attrPool.query(
      `SELECT id FROM reconciliation_line_item
       WHERE reconciliation_period_id = $1 AND attributed_domain_id = $2`,
      [periodId, domainId]
    );

    if (existingLineItem.rows.length > 0) {
      return NextResponse.json(
        { error: 'Domain is already in this reconciliation period' },
        { status: 400 }
      );
    }

    // Determine motion type: PLG (no meeting) or SALES (had meeting)
    const motionType = domain.has_meeting_booked ? 'SALES' : 'PLG';

    // Determine revshare rate based on billing model
    let revshareRate: number | null = null;
    if (period.billing_model === 'plg_sales_split') {
      revshareRate = motionType === 'PLG' ? period.revshare_plg : period.revshare_sales;
    } else {
      revshareRate = period.rev_share_rate;
    }

    // Create line item
    const lineItemId = randomUUID();
    const billingDate = new Date(billingStartDate);

    await attrPool.query(
      `INSERT INTO reconciliation_line_item (
        id, reconciliation_period_id, attributed_domain_id, domain,
        motion_type, signup_count, meeting_count, revshare_rate_applied,
        paying_customer_date, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', NOW(), NOW()
      )`,
      [
        lineItemId,
        periodId,
        domainId,
        domain.domain,
        motionType,
        domain.has_sign_up ? 1 : 0,
        domain.has_meeting_booked ? 1 : 0,
        revshareRate,
        billingDate,
      ]
    );

    // Update domain status to CLIENT_PROMOTED if not already attributed
    if (!['ATTRIBUTED', 'CLIENT_PROMOTED'].includes(domain.status)) {
      await attrPool.query(
        `UPDATE attributed_domain
         SET status = 'CLIENT_PROMOTED',
             promoted_at = NOW(),
             promoted_by = 'manual-reconciliation-add',
             updated_at = NOW()
         WHERE id = $1`,
        [domainId]
      );
    }

    // Recalculate period totals
    await attrPool.query(
      `UPDATE reconciliation_period
       SET total_paying_customers = (
         SELECT COUNT(*) FROM reconciliation_line_item
         WHERE reconciliation_period_id = $1
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [periodId]
    );

    return NextResponse.json({
      success: true,
      message: 'Domain added to reconciliation period',
      lineItemId,
      domain: domain.domain,
    });
  } catch (error) {
    console.error('Error adding domain to reconciliation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

