import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import { randomUUID } from 'crypto';
import { addMonths, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

/**
 * POST /api/clients/[slug]/[uuid]/reconciliation/add-domain
 * 
 * Globally add a domain to all applicable reconciliation periods based on the 12-month billing window.
 * 
 * This finds all OPEN/PENDING_CLIENT periods where the billing start date falls within the 12-month window
 * and creates line items in each applicable period.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;
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
      `SELECT id, rev_share_rate, revshare_plg, revshare_sales, 
              fee_per_signup, fee_per_meeting, billing_model
       FROM client_config WHERE slug = $1 AND access_uuid = $2`,
      [slug, uuid]
    );

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = clientResult.rows[0];
    const clientConfigId = client.id;

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
    const billingDate = startOfDay(new Date(billingStartDate));
    const billingWindowEnd = addMonths(billingDate, 12);

    // Get all periods for this client (OPEN, PENDING_CLIENT, or UPCOMING that might become active)
    const periodsResult = await attrPool.query(
      `SELECT id, period_name, start_date, end_date, status
       FROM reconciliation_period
       WHERE client_config_id = $1
         AND status IN ('OPEN', 'PENDING_CLIENT', 'UPCOMING')
       ORDER BY start_date ASC`,
      [clientConfigId]
    );

    const periods = periodsResult.rows;

    // Find all periods that fall within the 12-month billing window
    // A period is applicable if:
    // 1. billingStartDate <= period_end (became paying by end of period)
    // 2. billingStartDate + 12 months > period_start (12-month window extends into period)
    const applicablePeriods = periods.filter((period: { start_date: string; end_date: string }) => {
      const periodStart = startOfDay(new Date(period.start_date));
      const periodEnd = endOfDay(new Date(period.end_date));
      
      // Check if billing date is before or at period end
      const billingBeforePeriodEnd = !isAfter(billingDate, periodEnd);
      
      // Check if 12-month window extends into this period
      const windowExtendsIntoPeriod = isAfter(billingWindowEnd, periodStart);
      
      return billingBeforePeriodEnd && windowExtendsIntoPeriod;
    });

    if (applicablePeriods.length === 0) {
      return NextResponse.json(
        { error: 'No applicable billing periods found for this date. The domain may fall outside all current periods.' },
        { status: 400 }
      );
    }

    // Determine motion type: PLG (no meeting) or SALES (had meeting)
    const motionType = domain.has_meeting_booked ? 'SALES' : 'PLG';

    // Determine revshare rate based on billing model
    let revshareRate: number | null = null;
    if (client.billing_model === 'plg_sales_split') {
      revshareRate = motionType === 'PLG' ? client.revshare_plg : client.revshare_sales;
    } else {
      revshareRate = client.rev_share_rate;
    }

    // Create line items in all applicable periods
    const createdLineItems: { periodId: string; periodName: string; lineItemId: string }[] = [];
    const skippedPeriods: { periodId: string; periodName: string; reason: string }[] = [];

    for (const period of applicablePeriods) {
      // Check if line item already exists for this domain in this period
      const existingLineItem = await attrPool.query(
        `SELECT id FROM reconciliation_line_item
         WHERE reconciliation_period_id = $1 AND attributed_domain_id = $2`,
        [period.id, domainId]
      );

      if (existingLineItem.rows.length > 0) {
        skippedPeriods.push({
          periodId: period.id,
          periodName: period.period_name,
          reason: 'Already exists in this period',
        });
        continue;
      }

      // Create line item
      const lineItemId = randomUUID();

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
          period.id,
          domainId,
          domain.domain,
          motionType,
          domain.has_sign_up ? 1 : 0,
          domain.has_meeting_booked ? 1 : 0,
          revshareRate,
          billingDate,
        ]
      );

      createdLineItems.push({
        periodId: period.id,
        periodName: period.period_name,
        lineItemId,
      });

      // Update period totals
      await attrPool.query(
        `UPDATE reconciliation_period
         SET total_paying_customers = (
           SELECT COUNT(*) FROM reconciliation_line_item
           WHERE reconciliation_period_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [period.id]
      );
    }

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

    return NextResponse.json({
      success: true,
      message: `Domain added to ${createdLineItems.length} billing period(s)`,
      domain: domain.domain,
      billingStartDate: billingDate.toISOString(),
      periodsAdded: createdLineItems,
      periodsSkipped: skippedPeriods,
    });
  } catch (error) {
    console.error('Error adding domain to reconciliation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

