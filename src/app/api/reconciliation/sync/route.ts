import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';
import { calculatePeriods, type BillingCycle } from '@/lib/reconciliation/period-calculator';
import { format } from 'date-fns';

interface ClientConfig {
  id: string;
  client_name: string;
  contract_start_date: string | null;
  billing_cycle: BillingCycle;
  review_window_days: number;
  estimated_acv: number;
  rev_share_rate: number;
  billing_model: string;
  revshare_plg: number | null;
  revshare_sales: number | null;
}

/**
 * POST /api/reconciliation/sync
 * 
 * Syncs reconciliation periods for a client (or all clients).
 * - Calculates periods based on contract_start_date and billing_cycle
 * - Upserts periods into the database
 * - Auto-populates line items for OPEN periods
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, syncAll } = body as { clientId?: string; syncAll?: boolean };

    if (!clientId && !syncAll) {
      return NextResponse.json(
        { error: 'Either clientId or syncAll must be provided' },
        { status: 400 }
      );
    }

    // Get client(s) to sync
    let clients: ClientConfig[];
    if (syncAll) {
      clients = await attrQuery<ClientConfig>(`
        SELECT id, client_name, contract_start_date, 
               COALESCE(billing_cycle, 'monthly') as billing_cycle,
               COALESCE(review_window_days, 10) as review_window_days,
               COALESCE(estimated_acv, 10000) as estimated_acv,
               rev_share_rate,
               COALESCE(billing_model, 'flat_revshare') as billing_model,
               revshare_plg, revshare_sales
        FROM client_config
        WHERE contract_start_date IS NOT NULL
        ORDER BY client_name
      `);
    } else {
      clients = await attrQuery<ClientConfig>(`
        SELECT id, client_name, contract_start_date, 
               COALESCE(billing_cycle, 'monthly') as billing_cycle,
               COALESCE(review_window_days, 10) as review_window_days,
               COALESCE(estimated_acv, 10000) as estimated_acv,
               rev_share_rate,
               COALESCE(billing_model, 'flat_revshare') as billing_model,
               revshare_plg, revshare_sales
        FROM client_config
        WHERE id = $1
      `, [clientId]);
    }

    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'No clients found with contract_start_date set' },
        { status: 404 }
      );
    }

    const results = [];

    for (const client of clients) {
      if (!client.contract_start_date) {
        results.push({
          clientId: client.id,
          clientName: client.client_name,
          error: 'No contract_start_date set',
          periodsCreated: 0,
        });
        continue;
      }

      // Calculate periods
      const periods = calculatePeriods({
        contractStartDate: new Date(client.contract_start_date),
        billingCycle: client.billing_cycle,
        reviewWindowDays: client.review_window_days,
      });

      let periodsCreated = 0;
      let periodsUpdated = 0;
      let lineItemsCreated = 0;

      for (const period of periods) {
        // Determine status for database
        let dbStatus: string;
        switch (period.status) {
          case 'UPCOMING':
            dbStatus = 'UPCOMING';
            break;
          case 'OPEN':
            dbStatus = 'OPEN';
            break;
          case 'OVERDUE':
            dbStatus = 'OPEN'; // Still OPEN, but past deadline
            break;
          default:
            dbStatus = 'OPEN';
        }

        // Upsert the period
        const [upsertedPeriod] = await attrQuery<{ id: string; created_at: Date; updated_at: Date }>(`
          INSERT INTO reconciliation_period (
            client_config_id, period_name, start_date, end_date, 
            status, review_deadline, auto_generated, estimated_total
          ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          ON CONFLICT (client_config_id, period_name) 
          DO UPDATE SET
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            review_deadline = EXCLUDED.review_deadline,
            estimated_total = EXCLUDED.estimated_total,
            updated_at = NOW()
          RETURNING id, created_at, updated_at
        `, [
          client.id,
          period.period_name,
          format(period.start_date, 'yyyy-MM-dd'),
          format(period.end_date, 'yyyy-MM-dd'),
          dbStatus,
          format(period.review_deadline, 'yyyy-MM-dd'),
          0, // estimated_total will be calculated after line items
        ]);

        // Check if this was a create or update
        if (upsertedPeriod.created_at.getTime() === upsertedPeriod.updated_at.getTime()) {
          periodsCreated++;
        } else {
          periodsUpdated++;
        }

        // For OPEN periods, populate line items from attributed domains
        if (period.status === 'OPEN' || period.status === 'OVERDUE') {
          const lineItems = await populateLineItems(
            upsertedPeriod.id,
            client.id,
            period.start_date,
            period.end_date,
            client
          );
          lineItemsCreated += lineItems;

          // Update estimated total
          await updateEstimatedTotal(upsertedPeriod.id, client);
        }
      }

      results.push({
        clientId: client.id,
        clientName: client.client_name,
        periodsCreated,
        periodsUpdated,
        lineItemsCreated,
        totalPeriods: periods.length,
      });
    }

    return NextResponse.json({
      success: true,
      results,
      totalClients: clients.length,
    });
  } catch (error) {
    console.error('Error syncing reconciliation periods:', error);
    return NextResponse.json(
      { error: 'Failed to sync periods', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Populate line items for a period from attributed domains
 */
async function populateLineItems(
  periodId: string,
  clientConfigId: string,
  startDate: Date,
  endDate: Date,
  client: ClientConfig
): Promise<number> {
  // Get attributed domains with paying customers in this period
  const domains = await attrQuery<{
    id: string;
    domain: string;
    has_sign_up: boolean;
    has_meeting_booked: boolean;
    has_paying_customer: boolean;
    first_event_at: Date;
  }>(`
    SELECT ad.id, ad.domain, ad.has_sign_up, ad.has_meeting_booked, 
           ad.has_paying_customer, ad.first_event_at
    FROM attributed_domain ad
    WHERE ad.client_config_id = $1
      AND ad.status IN ('ATTRIBUTED', 'MANUAL')
      AND ad.has_paying_customer = true
      AND ad.first_event_at >= $2
      AND ad.first_event_at <= $3
  `, [clientConfigId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')]);

  let created = 0;

  for (const domain of domains) {
    // Determine motion type: PLG (no meeting) or SALES (had meeting)
    const motionType = domain.has_meeting_booked ? 'SALES' : 'PLG';

    // Determine revshare rate to apply
    let revshareRate: number | null = null;
    if (client.billing_model === 'plg_sales_split') {
      revshareRate = motionType === 'PLG' 
        ? client.revshare_plg 
        : client.revshare_sales;
    } else {
      revshareRate = client.rev_share_rate;
    }

    // Count sign-ups and meetings for this domain in the period
    const [counts] = await attrQuery<{ signup_count: number; meeting_count: number }>(`
      SELECT 
        COUNT(CASE WHEN event_type = 'SIGN_UP' THEN 1 END) as signup_count,
        COUNT(CASE WHEN event_type = 'MEETING_BOOKED' THEN 1 END) as meeting_count
      FROM domain_event
      WHERE attributed_domain_id = $1
        AND event_at >= $2
        AND event_at <= $3
    `, [domain.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd 23:59:59')]);

    // Upsert line item
    await attrQuery(`
      INSERT INTO reconciliation_line_item (
        reconciliation_period_id, attributed_domain_id, domain,
        motion_type, signup_count, meeting_count, revshare_rate_applied, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
      ON CONFLICT (reconciliation_period_id, domain)
      DO UPDATE SET
        motion_type = EXCLUDED.motion_type,
        signup_count = EXCLUDED.signup_count,
        meeting_count = EXCLUDED.meeting_count,
        revshare_rate_applied = EXCLUDED.revshare_rate_applied,
        updated_at = NOW()
    `, [
      periodId,
      domain.id,
      domain.domain,
      motionType,
      counts?.signup_count || 0,
      counts?.meeting_count || 0,
      revshareRate,
    ]);

    created++;
  }

  return created;
}

/**
 * Update the estimated total for a period based on line items and estimated ACV
 */
async function updateEstimatedTotal(periodId: string, client: ClientConfig): Promise<void> {
  // Count paying customers in this period
  const [result] = await attrQuery<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM reconciliation_line_item
    WHERE reconciliation_period_id = $1
  `, [periodId]);

  const payingCount = result?.count || 0;
  
  // Calculate estimated total
  let estimatedTotal = 0;
  if (client.billing_model === 'plg_sales_split') {
    // For split model, use average of the two rates
    const avgRate = ((client.revshare_plg || 0) + (client.revshare_sales || 0)) / 2;
    estimatedTotal = payingCount * client.estimated_acv * avgRate;
  } else {
    estimatedTotal = payingCount * client.estimated_acv * client.rev_share_rate;
  }

  await attrQuery(`
    UPDATE reconciliation_period
    SET estimated_total = $1, 
        total_paying_customers = $2,
        updated_at = NOW()
    WHERE id = $3
  `, [estimatedTotal, payingCount, periodId]);
}

// GET endpoint to get sync status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  try {
    let query = `
      SELECT 
        cc.id as client_id,
        cc.client_name,
        cc.contract_start_date,
        cc.billing_cycle,
        COUNT(rp.id) as total_periods,
        COUNT(CASE WHEN rp.status = 'OPEN' THEN 1 END) as open_periods,
        COUNT(CASE WHEN rp.status = 'FINALIZED' THEN 1 END) as finalized_periods,
        MAX(rp.updated_at) as last_sync
      FROM client_config cc
      LEFT JOIN reconciliation_period rp ON cc.id = rp.client_config_id
    `;

    const params: string[] = [];
    if (clientId) {
      query += ` WHERE cc.id = $1`;
      params.push(clientId);
    }

    query += ` GROUP BY cc.id ORDER BY cc.client_name`;

    const results = await attrQuery(query, params);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

