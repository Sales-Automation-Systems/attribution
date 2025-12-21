// Admin Stats API with Date Filtering
// Returns aggregate attribution stats across all clients, filtered by event date range

import { NextRequest, NextResponse } from 'next/server';
import { attrQuery } from '@/db';

interface AggregateStats {
  totalAttributedDomains: number;
  totalPayingCustomers: number;
  totalHardMatches: number;
  totalSoftMatches: number;
  pendingDisputes: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse date filters
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    // If no date filter, return the standard aggregate stats
    if (!startDate && !endDate) {
      const rows = await attrQuery<{
        total_attributed_domains: string;
        total_paying_customers: string;
        total_hard_matches: string;
        total_soft_matches: string;
        pending_disputes: string;
      }>(`
        SELECT 
          COUNT(*) FILTER (WHERE is_within_window = true) as total_attributed_domains,
          COUNT(*) FILTER (WHERE has_paying_customer = true) as total_paying_customers,
          COUNT(*) FILTER (WHERE match_type = 'HARD_MATCH') as total_hard_matches,
          COUNT(*) FILTER (WHERE match_type = 'SOFT_MATCH') as total_soft_matches,
          COUNT(*) FILTER (WHERE status = 'DISPUTE_PENDING') as pending_disputes
        FROM attributed_domain
      `, []);

      return NextResponse.json({
        stats: {
          totalAttributedDomains: parseInt(rows[0]?.total_attributed_domains || '0', 10),
          totalPayingCustomers: parseInt(rows[0]?.total_paying_customers || '0', 10),
          totalHardMatches: parseInt(rows[0]?.total_hard_matches || '0', 10),
          totalSoftMatches: parseInt(rows[0]?.total_soft_matches || '0', 10),
          pendingDisputes: parseInt(rows[0]?.pending_disputes || '0', 10),
        } as AggregateStats,
        dateRange: null,
      });
    }

    // With date filter - count events by source/type filtered by event_time
    const dateFilter = [];
    const queryParams: unknown[] = [];
    let paramIndex = 1;
    
    if (startDate) {
      dateFilter.push(`de.event_time >= $${paramIndex}::timestamp`);
      queryParams.push(startDate.toISOString());
      paramIndex++;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter.push(`de.event_time <= $${paramIndex}::timestamp`);
      queryParams.push(endOfDay.toISOString());
    }
    
    const dateWhereClause = dateFilter.length > 0 ? `AND ${dateFilter.join(' AND ')}` : '';

    // Count attributed domains with events in date range
    const attributedQuery = `
      SELECT COUNT(DISTINCT ad.id) as count
      FROM attributed_domain ad
      JOIN domain_event de ON de.attributed_domain_id = ad.id
      WHERE ad.is_within_window = true
        AND ad.status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
        ${dateWhereClause}
    `;
    
    const attributedRows = await attrQuery<{ count: string }>(attributedQuery, queryParams);

    // Count paying customers with PAYING_CUSTOMER events in date range
    const payingQuery = `
      SELECT COUNT(DISTINCT ad.id) as count
      FROM attributed_domain ad
      JOIN domain_event de ON de.attributed_domain_id = ad.id
      WHERE ad.has_paying_customer = true
        AND de.event_source = 'PAYING_CUSTOMER'
        ${dateWhereClause}
    `;
    
    const payingRows = await attrQuery<{ count: string }>(payingQuery, queryParams);

    // Count hard matches with events in date range
    const hardMatchQuery = `
      SELECT COUNT(DISTINCT ad.id) as count
      FROM attributed_domain ad
      JOIN domain_event de ON de.attributed_domain_id = ad.id
      WHERE ad.match_type = 'HARD_MATCH'
        AND ad.is_within_window = true
        ${dateWhereClause}
    `;
    
    const hardMatchRows = await attrQuery<{ count: string }>(hardMatchQuery, queryParams);

    // Count soft matches with events in date range
    const softMatchQuery = `
      SELECT COUNT(DISTINCT ad.id) as count
      FROM attributed_domain ad
      JOIN domain_event de ON de.attributed_domain_id = ad.id
      WHERE ad.match_type = 'SOFT_MATCH'
        AND ad.is_within_window = true
        ${dateWhereClause}
    `;
    
    const softMatchRows = await attrQuery<{ count: string }>(softMatchQuery, queryParams);

    // Pending disputes (not filtered by date - disputes are a current state)
    const disputeRows = await attrQuery<{ count: string }>(`
      SELECT COUNT(*) as count FROM attributed_domain WHERE status = 'DISPUTE_PENDING'
    `, []);

    return NextResponse.json({
      stats: {
        totalAttributedDomains: parseInt(attributedRows[0]?.count || '0', 10),
        totalPayingCustomers: parseInt(payingRows[0]?.count || '0', 10),
        totalHardMatches: parseInt(hardMatchRows[0]?.count || '0', 10),
        totalSoftMatches: parseInt(softMatchRows[0]?.count || '0', 10),
        pendingDisputes: parseInt(disputeRows[0]?.count || '0', 10),
      } as AggregateStats,
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: (error as Error).message },
      { status: 500 }
    );
  }
}

