import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

// POST preview reconciliation data for a date range
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, startDate, endDate } = body;

    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Count paying customers in range
    const [payingCount] = await attrQuery<{ count: number }>(`
      SELECT COUNT(*)::int as count
      FROM attributed_domain
      WHERE client_config_id = $1
        AND has_paying_customer = true
        AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
        AND first_event_at >= $2
        AND first_event_at <= $3
    `, [clientId, startDate, endDate]);

    // Count signups in range
    const [signupCount] = await attrQuery<{ count: number }>(`
      SELECT COUNT(DISTINCT de.id)::int as count
      FROM domain_event de
      JOIN attributed_domain ad ON ad.id = de.attributed_domain_id
      WHERE ad.client_config_id = $1
        AND de.event_source = 'SIGN_UP'
        AND ad.status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
        AND de.event_time >= $2
        AND de.event_time <= $3
    `, [clientId, startDate, endDate]);

    // Count meetings in range
    const [meetingCount] = await attrQuery<{ count: number }>(`
      SELECT COUNT(DISTINCT de.id)::int as count
      FROM domain_event de
      JOIN attributed_domain ad ON ad.id = de.attributed_domain_id
      WHERE ad.client_config_id = $1
        AND de.event_source = 'MEETING_BOOKED'
        AND ad.status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
        AND de.event_time >= $2
        AND de.event_time <= $3
    `, [clientId, startDate, endDate]);

    return NextResponse.json({
      paying_customers: payingCount?.count || 0,
      signups: signupCount?.count || 0,
      meetings: meetingCount?.count || 0,
    });
  } catch (error) {
    console.error('Error previewing reconciliation data:', error);
    return NextResponse.json(
      { error: 'Failed to preview data' },
      { status: 500 }
    );
  }
}

