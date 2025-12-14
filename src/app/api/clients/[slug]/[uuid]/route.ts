// Single Client API
// Get client by slug and UUID

import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid, getDashboardStats, getAttributedDomains, getReconciliationPeriods } from '@/db/attribution/queries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;

    const client = await getClientConfigBySlugAndUuid(slug, uuid);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get stats
    const stats = await getDashboardStats(client.id);

    // Get recent attributed domains
    const recentDomains = await getAttributedDomains(client.id, { limit: 10 });

    // Get reconciliation periods
    const periods = await getReconciliationPeriods(client.id);

    return NextResponse.json({
      client: {
        id: client.id,
        clientId: client.client_id,
        clientName: client.client_name,
        slug: client.slug,
        accessUuid: client.access_uuid,
        revShareRate: client.rev_share_rate,
        createdAt: client.created_at,
      },
      stats: {
        totalAttributed: stats.total_attributed_domains,
        totalPaying: stats.total_paying_customers,
        hardMatches: stats.total_hard_matches,
        softMatches: stats.total_soft_matches,
        pendingDisputes: stats.pending_disputes,
      },
      recentDomains: recentDomains.map((d) => ({
        id: d.id,
        domain: d.domain,
        matchType: d.match_type,
        status: d.status,
        hasPositiveReply: d.has_positive_reply,
        hasSignUp: d.has_sign_up,
        hasMeetingBooked: d.has_meeting_booked,
        hasPayingCustomer: d.has_paying_customer,
        isWithinWindow: d.is_within_window,
        firstEventAt: d.first_event_at,
      })),
      reconciliationPeriods: periods.map((p) => ({
        id: p.id,
        year: p.year,
        month: p.month,
        status: p.status,
        netNewAttributed: p.net_new_attributed,
        netNewPaying: p.net_new_paying,
        totalRevenue: p.total_revenue,
        revShareAmount: p.rev_share_amount,
        deadline: p.deadline,
      })),
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client', details: (error as Error).message },
      { status: 500 }
    );
  }
}

