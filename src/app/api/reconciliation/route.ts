import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';
import type { ReconciliationPeriod, ReconciliationLineItem } from '@/db/attribution/types';

// GET all reconciliation periods (for agency dashboard)
export async function GET() {
  try {
    const periods = await attrQuery<ReconciliationPeriod & { client_name: string; client_slug: string }>(`
      SELECT 
        rp.*,
        cc.client_name,
        cc.slug as client_slug
      FROM reconciliation_period rp
      JOIN client_config cc ON cc.id = rp.client_config_id
      ORDER BY rp.created_at DESC
    `);

    return NextResponse.json(periods);
  } catch (error) {
    console.error('Error fetching reconciliation periods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation periods' },
      { status: 500 }
    );
  }
}

// POST create a new reconciliation period
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, periodName, startDate, endDate, notes } = body;

    if (!clientId || !periodName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get client config for billing settings
    const [clientConfig] = await attrQuery<{
      id: string;
      billing_model: string;
      rev_share_rate: number;
      revshare_plg: number | null;
      revshare_sales: number | null;
      fee_per_signup: number | null;
      fee_per_meeting: number | null;
    }>(`
      SELECT id, billing_model, rev_share_rate, revshare_plg, revshare_sales, fee_per_signup, fee_per_meeting
      FROM client_config WHERE id = $1
    `, [clientId]);

    if (!clientConfig) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get attributed domains with paying customers in the date range
    const payingDomains = await attrQuery<{
      id: string;
      domain: string;
      has_meeting_booked: boolean;
      first_event_at: Date;
    }>(`
      SELECT ad.id, ad.domain, ad.has_meeting_booked, ad.first_event_at
      FROM attributed_domain ad
      WHERE ad.client_config_id = $1
        AND ad.has_paying_customer = true
        AND ad.status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
        AND ad.first_event_at >= $2
        AND ad.first_event_at <= $3
    `, [clientId, startDate, endDate]);

    // Get attributed signups and meetings counts
    const eventCounts = await attrQuery<{
      domain: string;
      signup_count: number;
      meeting_count: number;
    }>(`
      SELECT 
        ad.domain,
        COUNT(CASE WHEN de.event_source = 'SIGN_UP' THEN 1 END)::int as signup_count,
        COUNT(CASE WHEN de.event_source = 'MEETING_BOOKED' THEN 1 END)::int as meeting_count
      FROM attributed_domain ad
      LEFT JOIN domain_event de ON de.attributed_domain_id = ad.id
        AND de.event_time >= $2
        AND de.event_time <= $3
      WHERE ad.client_config_id = $1
        AND ad.status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
      GROUP BY ad.domain
    `, [clientId, startDate, endDate]);

    const eventCountsMap = new Map(eventCounts.map(e => [e.domain, e]));

    // Create the reconciliation period
    const [period] = await attrQuery<ReconciliationPeriod>(`
      INSERT INTO reconciliation_period (
        client_config_id, period_name, start_date, end_date,
        status, created_by, agency_notes,
        total_paying_customers, total_signups, total_meetings
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', 'system', $5, $6, $7, $8)
      RETURNING *
    `, [
      clientId,
      periodName,
      startDate,
      endDate,
      notes || null,
      payingDomains.length,
      eventCounts.reduce((sum, e) => sum + e.signup_count, 0),
      eventCounts.reduce((sum, e) => sum + e.meeting_count, 0),
    ]);

    // Create line items for each paying customer
    for (const domain of payingDomains) {
      const counts = eventCountsMap.get(domain.domain) || { signup_count: 0, meeting_count: 0 };
      const motionType = domain.has_meeting_booked ? 'SALES' : 'PLG';
      
      // Determine the applicable rate
      let revshareRate: number | null = null;
      if (clientConfig.billing_model === 'plg_sales_split') {
        revshareRate = motionType === 'PLG' ? clientConfig.revshare_plg : clientConfig.revshare_sales;
      } else {
        revshareRate = clientConfig.rev_share_rate;
      }

      await attrQuery<ReconciliationLineItem>(`
        INSERT INTO reconciliation_line_item (
          reconciliation_period_id, attributed_domain_id, domain,
          motion_type, signup_count, meeting_count,
          revshare_rate_applied, signup_fee_applied, meeting_fee_applied,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
      `, [
        period.id,
        domain.id,
        domain.domain,
        motionType,
        counts.signup_count,
        counts.meeting_count,
        revshareRate,
        clientConfig.fee_per_signup,
        clientConfig.fee_per_meeting,
      ]);
    }

    return NextResponse.json(period);
  } catch (error) {
    console.error('Error creating reconciliation period:', error);
    return NextResponse.json(
      { error: 'Failed to create reconciliation period' },
      { status: 500 }
    );
  }
}



