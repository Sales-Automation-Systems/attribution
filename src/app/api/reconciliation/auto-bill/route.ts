import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

interface OverduePeriod {
  id: string;
  client_config_id: string;
  period_name: string;
  review_deadline: Date;
  estimated_total: number;
  client_name: string;
  estimated_acv: number;
  rev_share_rate: number;
  billing_model: string;
  revshare_plg: number | null;
  revshare_sales: number | null;
}

interface LineItem {
  id: string;
  domain: string;
  revenue_submitted: number | null;
  motion_type: string | null;
  revshare_rate_applied: number | null;
}

/**
 * POST /api/reconciliation/auto-bill
 * 
 * Processes all overdue reconciliation periods and auto-bills them.
 * This should be run daily (e.g., via cron job or manual trigger).
 * 
 * For each overdue period:
 * 1. Find line items without revenue_submitted
 * 2. Calculate amount using estimated_acv
 * 3. Update line items with estimated values
 * 4. Update period status to AUTO_BILLED
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { dryRun = false } = body as { dryRun?: boolean };

    // Find all overdue periods (past review_deadline, still OPEN)
    const overduePeriods = await attrQuery<OverduePeriod>(`
      SELECT 
        rp.id,
        rp.client_config_id,
        rp.period_name,
        rp.review_deadline,
        rp.estimated_total,
        cc.client_name,
        COALESCE(cc.estimated_acv, 10000) as estimated_acv,
        cc.rev_share_rate,
        COALESCE(cc.billing_model, 'flat_revshare') as billing_model,
        cc.revshare_plg,
        cc.revshare_sales
      FROM reconciliation_period rp
      JOIN client_config cc ON cc.id = rp.client_config_id
      WHERE rp.status = 'OPEN'
        AND rp.review_deadline IS NOT NULL
        AND rp.review_deadline < NOW()
      ORDER BY rp.review_deadline ASC
    `);

    if (overduePeriods.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overdue periods to process',
        processed: 0,
      });
    }

    const results = [];

    for (const period of overduePeriods) {
      // Get line items that don't have revenue submitted
      const lineItems = await attrQuery<LineItem>(`
        SELECT id, domain, revenue_submitted, motion_type, revshare_rate_applied
        FROM reconciliation_line_item
        WHERE reconciliation_period_id = $1
      `, [period.id]);

      const itemsToAutoBill = lineItems.filter(item => 
        item.revenue_submitted === null || item.revenue_submitted === 0
      );

      let totalAutoBilled = 0;
      let itemsProcessed = 0;

      for (const item of itemsToAutoBill) {
        // Determine the rate to apply
        let rate: number;
        if (period.billing_model === 'plg_sales_split') {
          rate = item.motion_type === 'PLG' 
            ? (period.revshare_plg || 0)
            : (period.revshare_sales || 0);
        } else {
          rate = item.revshare_rate_applied || period.rev_share_rate;
        }

        // Calculate amount using estimated ACV
        const estimatedRevenue = period.estimated_acv;
        const amountOwed = estimatedRevenue * rate;

        if (!dryRun) {
          // Update line item with estimated values
          await attrQuery(`
            UPDATE reconciliation_line_item
            SET 
              revenue_submitted = $1,
              revenue_notes = 'Auto-billed (estimated)',
              amount_owed = $2,
              status = 'SUBMITTED',
              revenue_submitted_at = NOW(),
              updated_at = NOW()
            WHERE id = $3
          `, [estimatedRevenue, amountOwed, item.id]);
        }

        totalAutoBilled += amountOwed;
        itemsProcessed++;
      }

      // Calculate totals for items that were already submitted
      const alreadySubmitted = lineItems.filter(item => 
        item.revenue_submitted !== null && item.revenue_submitted > 0
      );
      
      let submittedTotal = 0;
      for (const item of alreadySubmitted) {
        const rate = item.revshare_rate_applied || period.rev_share_rate;
        submittedTotal += (item.revenue_submitted || 0) * rate;
      }

      const totalAmountOwed = totalAutoBilled + submittedTotal;

      if (!dryRun) {
        // Update period status to AUTO_BILLED
        await attrQuery(`
          UPDATE reconciliation_period
          SET 
            status = 'AUTO_BILLED',
            auto_billed_at = NOW(),
            total_amount_owed = $1,
            total_revenue_submitted = $2,
            agency_notes = COALESCE(agency_notes, '') || E'\n\n[Auto-billed on ' || to_char(NOW(), 'YYYY-MM-DD') || ': ' || $3 || ' items billed at estimated ACV]',
            updated_at = NOW()
          WHERE id = $4
        `, [
          totalAmountOwed,
          lineItems.length * period.estimated_acv, // Total estimated revenue
          itemsProcessed,
          period.id,
        ]);
      }

      results.push({
        periodId: period.id,
        periodName: period.period_name,
        clientName: period.client_name,
        reviewDeadline: period.review_deadline,
        totalLineItems: lineItems.length,
        itemsAutoBilled: itemsProcessed,
        itemsAlreadySubmitted: alreadySubmitted.length,
        totalAutoBilledAmount: totalAutoBilled,
        totalAmountOwed,
        dryRun,
      });
    }

    return NextResponse.json({
      success: true,
      message: dryRun 
        ? 'Dry run complete - no changes made'
        : `Auto-billed ${results.length} overdue periods`,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Error in auto-billing:', error);
    return NextResponse.json(
      { error: 'Auto-billing failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET endpoint to check for overdue periods
export async function GET() {
  try {
    const overduePeriods = await attrQuery<{
      id: string;
      period_name: string;
      client_name: string;
      review_deadline: Date;
      estimated_total: number;
      line_item_count: number;
      pending_count: number;
    }>(`
      SELECT 
        rp.id,
        rp.period_name,
        cc.client_name,
        rp.review_deadline,
        rp.estimated_total,
        COUNT(rli.id) as line_item_count,
        COUNT(CASE WHEN rli.revenue_submitted IS NULL THEN 1 END) as pending_count
      FROM reconciliation_period rp
      JOIN client_config cc ON cc.id = rp.client_config_id
      LEFT JOIN reconciliation_line_item rli ON rli.reconciliation_period_id = rp.id
      WHERE rp.status = 'OPEN'
        AND rp.review_deadline IS NOT NULL
        AND rp.review_deadline < NOW()
      GROUP BY rp.id, rp.period_name, cc.client_name, rp.review_deadline, rp.estimated_total
      ORDER BY rp.review_deadline ASC
    `);

    return NextResponse.json({
      overduePeriods,
      count: overduePeriods.length,
    });
  } catch (error) {
    console.error('Error checking overdue periods:', error);
    return NextResponse.json(
      { error: 'Failed to check overdue periods' },
      { status: 500 }
    );
  }
}




