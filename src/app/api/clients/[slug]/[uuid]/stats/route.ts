// Client Stats API with Date Filtering
// Returns attribution stats filtered by event date range

import { NextRequest, NextResponse } from 'next/server';
import { getClientConfigBySlugAndUuid } from '@/db/attribution/queries';
import { attrQuery } from '@/db';

interface FilteredStats {
  // Total events in the pipeline (unfiltered - these are client's overall numbers)
  totalEmailsSent: number;
  
  // Attributed events (filtered by date range when provided)
  attributedPositiveReplies: number;
  attributedSignUps: number;
  attributedMeetings: number;
  attributedPaying: number;
  
  // Hard match breakdown
  hardMatchPositiveReplies: number;
  hardMatchSignUps: number;
  hardMatchMeetings: number;
  hardMatchPaying: number;
  
  // Soft match breakdown
  softMatchPositiveReplies: number;
  softMatchSignUps: number;
  softMatchMeetings: number;
  softMatchPaying: number;
  
  // Outside window
  outsideWindowSignUps: number;
  outsideWindowMeetings: number;
  outsideWindowPaying: number;
  
  // Not matched
  notMatchedSignUps: number;
  notMatchedMeetings: number;
  notMatchedPaying: number;
}

// Domain/Account level stats (counts unique domains, not individual events)
interface AccountStats {
  // Total accounts with each event type
  totalAccountsWithReplies: number;
  totalAccountsWithSignUps: number;
  totalAccountsWithMeetings: number;
  totalAccountsWithPaying: number;
  
  // Attributed accounts
  attributedAccountsWithReplies: number;
  attributedAccountsWithSignUps: number;
  attributedAccountsWithMeetings: number;
  attributedAccountsWithPaying: number;
  
  // Outside window accounts
  outsideWindowAccountsWithSignUps: number;
  outsideWindowAccountsWithMeetings: number;
  outsideWindowAccountsWithPaying: number;
  
  // Unattributed accounts
  unattributedAccountsWithSignUps: number;
  unattributedAccountsWithMeetings: number;
  unattributedAccountsWithPaying: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; uuid: string }> }
) {
  try {
    const { slug, uuid } = await params;
    const { searchParams } = new URL(req.url);
    
    // Parse date filters
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const client = await getClientConfigBySlugAndUuid(slug, uuid);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // If no date filter, return the pre-computed stats from client_config
    // But still need to query account-level stats
    if (!startDate && !endDate) {
      // Query account-level stats even for unfiltered view
      const accountCountsQuery = `
        SELECT 
          COUNT(DISTINCT CASE WHEN has_positive_reply THEN id END) as accounts_with_replies,
          COUNT(DISTINCT CASE WHEN has_sign_up THEN id END) as accounts_with_signups,
          COUNT(DISTINCT CASE WHEN has_meeting_booked THEN id END) as accounts_with_meetings,
          COUNT(DISTINCT CASE WHEN has_paying_customer THEN id END) as accounts_with_paying,
          COUNT(DISTINCT CASE WHEN has_positive_reply AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_replies,
          COUNT(DISTINCT CASE WHEN has_sign_up AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_signups,
          COUNT(DISTINCT CASE WHEN has_meeting_booked AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_meetings,
          COUNT(DISTINCT CASE WHEN has_paying_customer AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_paying,
          COUNT(DISTINCT CASE WHEN has_sign_up AND NOT is_within_window AND match_type != 'NO_MATCH' THEN id END) as outside_accounts_signups,
          COUNT(DISTINCT CASE WHEN has_meeting_booked AND NOT is_within_window AND match_type != 'NO_MATCH' THEN id END) as outside_accounts_meetings,
          COUNT(DISTINCT CASE WHEN has_paying_customer AND NOT is_within_window AND match_type != 'NO_MATCH' THEN id END) as outside_accounts_paying,
          COUNT(DISTINCT CASE WHEN has_sign_up AND match_type = 'NO_MATCH' THEN id END) as unattributed_accounts_signups,
          COUNT(DISTINCT CASE WHEN has_meeting_booked AND match_type = 'NO_MATCH' THEN id END) as unattributed_accounts_meetings,
          COUNT(DISTINCT CASE WHEN has_paying_customer AND match_type = 'NO_MATCH' THEN id END) as unattributed_accounts_paying
        FROM attributed_domain
        WHERE client_config_id = $1
      `;
      
      const accountCountsRows = await attrQuery<{
        accounts_with_replies: string;
        accounts_with_signups: string;
        accounts_with_meetings: string;
        accounts_with_paying: string;
        attributed_accounts_replies: string;
        attributed_accounts_signups: string;
        attributed_accounts_meetings: string;
        attributed_accounts_paying: string;
        outside_accounts_signups: string;
        outside_accounts_meetings: string;
        outside_accounts_paying: string;
        unattributed_accounts_signups: string;
        unattributed_accounts_meetings: string;
        unattributed_accounts_paying: string;
      }>(accountCountsQuery, [client.id]);
      
      const accountRow = accountCountsRows[0];
      
      return NextResponse.json({
        stats: {
          totalEmailsSent: Number(client.total_emails_sent || 0),
          attributedPositiveReplies: Number(client.attributed_positive_replies || 0),
          attributedSignUps: Number(client.attributed_sign_ups || 0),
          attributedMeetings: Number(client.attributed_meetings_booked || 0),
          attributedPaying: Number(client.attributed_paying_customers || 0),
          hardMatchPositiveReplies: Number(client.hard_match_positive_replies || 0),
          hardMatchSignUps: Number(client.hard_match_sign_ups || 0),
          hardMatchMeetings: Number(client.hard_match_meetings || 0),
          hardMatchPaying: Number(client.hard_match_paying || 0),
          softMatchPositiveReplies: Number(client.soft_match_positive_replies || 0),
          softMatchSignUps: Number(client.soft_match_sign_ups || 0),
          softMatchMeetings: Number(client.soft_match_meetings || 0),
          softMatchPaying: Number(client.soft_match_paying || 0),
          outsideWindowSignUps: Number(client.outside_window_sign_ups || 0),
          outsideWindowMeetings: Number(client.outside_window_meetings || 0),
          outsideWindowPaying: Number(client.outside_window_paying || 0),
          notMatchedSignUps: Number(client.not_matched_sign_ups || 0),
          notMatchedMeetings: Number(client.not_matched_meetings || 0),
          notMatchedPaying: Number(client.not_matched_paying || 0),
        } as FilteredStats,
        accountStats: {
          totalAccountsWithReplies: parseInt(accountRow?.accounts_with_replies || '0', 10),
          totalAccountsWithSignUps: parseInt(accountRow?.accounts_with_signups || '0', 10),
          totalAccountsWithMeetings: parseInt(accountRow?.accounts_with_meetings || '0', 10),
          totalAccountsWithPaying: parseInt(accountRow?.accounts_with_paying || '0', 10),
          attributedAccountsWithReplies: parseInt(accountRow?.attributed_accounts_replies || '0', 10),
          attributedAccountsWithSignUps: parseInt(accountRow?.attributed_accounts_signups || '0', 10),
          attributedAccountsWithMeetings: parseInt(accountRow?.attributed_accounts_meetings || '0', 10),
          attributedAccountsWithPaying: parseInt(accountRow?.attributed_accounts_paying || '0', 10),
          outsideWindowAccountsWithSignUps: parseInt(accountRow?.outside_accounts_signups || '0', 10),
          outsideWindowAccountsWithMeetings: parseInt(accountRow?.outside_accounts_meetings || '0', 10),
          outsideWindowAccountsWithPaying: parseInt(accountRow?.outside_accounts_paying || '0', 10),
          unattributedAccountsWithSignUps: parseInt(accountRow?.unattributed_accounts_signups || '0', 10),
          unattributedAccountsWithMeetings: parseInt(accountRow?.unattributed_accounts_meetings || '0', 10),
          unattributedAccountsWithPaying: parseInt(accountRow?.unattributed_accounts_paying || '0', 10),
        } as AccountStats,
        dateRange: null,
      });
    }

    // Query domain_event for filtered stats
    // Count events by source and match type, filtering by event_time
    const dateFilter = [];
    const queryParams: unknown[] = [client.id];
    let paramIndex = 2;
    
    if (startDate) {
      dateFilter.push(`de.event_time >= $${paramIndex}::timestamp`);
      queryParams.push(startDate.toISOString());
      paramIndex++;
    }
    if (endDate) {
      // Add one day to include the end date fully
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter.push(`de.event_time <= $${paramIndex}::timestamp`);
      queryParams.push(endOfDay.toISOString());
    }
    
    const dateWhereClause = dateFilter.length > 0 ? `AND ${dateFilter.join(' AND ')}` : '';

    // Email count: Always show total (unfiltered) from client_config
    // Date filtering for emails requires production DB access which isn't available from Vercel
    // The attribution DB only stores one EMAIL_SENT event per domain (first email), not individual emails
    const totalEmailsSent = Number(client.total_emails_sent || 0);

    // Query for attributed events (within window)
    const attributedQuery = `
      SELECT 
        de.event_source,
        ad.match_type,
        COUNT(*) as count
      FROM domain_event de
      JOIN attributed_domain ad ON ad.id = de.attributed_domain_id
      WHERE ad.client_config_id = $1
        AND ad.is_within_window = true
        AND ad.status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED')
        AND de.event_source IN ('POSITIVE_REPLY', 'SIGN_UP', 'MEETING_BOOKED', 'PAYING_CUSTOMER')
        ${dateWhereClause}
      GROUP BY de.event_source, ad.match_type
    `;
    
    const attributedRows = await attrQuery<{
      event_source: string;
      match_type: string;
      count: string;
    }>(attributedQuery, queryParams);

    // Query for outside window events
    const outsideWindowQuery = `
      SELECT 
        de.event_source,
        COUNT(*) as count
      FROM domain_event de
      JOIN attributed_domain ad ON ad.id = de.attributed_domain_id
      WHERE ad.client_config_id = $1
        AND ad.is_within_window = false
        AND ad.match_type != 'NO_MATCH'
        AND de.event_source IN ('SIGN_UP', 'MEETING_BOOKED', 'PAYING_CUSTOMER')
        ${dateWhereClause}
      GROUP BY de.event_source
    `;
    
    const outsideWindowRows = await attrQuery<{
      event_source: string;
      count: string;
    }>(outsideWindowQuery, queryParams);

    // Query for unmatched events
    const unmatchedQuery = `
      SELECT 
        de.event_source,
        COUNT(*) as count
      FROM domain_event de
      JOIN attributed_domain ad ON ad.id = de.attributed_domain_id
      WHERE ad.client_config_id = $1
        AND ad.match_type = 'NO_MATCH'
        AND de.event_source IN ('SIGN_UP', 'MEETING_BOOKED', 'PAYING_CUSTOMER')
        ${dateWhereClause}
      GROUP BY de.event_source
    `;
    
    const unmatchedRows = await attrQuery<{
      event_source: string;
      count: string;
    }>(unmatchedQuery, queryParams);

    // ========== ACCOUNT-LEVEL QUERIES ==========
    // Count unique domains instead of individual events
    
    // Total accounts with each event type (regardless of attribution status)
    const totalAccountsQuery = `
      SELECT 
        CASE 
          WHEN ad.has_positive_reply THEN 'POSITIVE_REPLY'
          WHEN ad.has_sign_up THEN 'SIGN_UP'
          WHEN ad.has_meeting_booked THEN 'MEETING_BOOKED'
          WHEN ad.has_paying_customer THEN 'PAYING_CUSTOMER'
        END as event_type,
        COUNT(DISTINCT ad.id) as count
      FROM attributed_domain ad
      WHERE ad.client_config_id = $1
      GROUP BY event_type
    `;
    
    // Actually, we need separate counts for each boolean flag
    const accountCountsQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN has_positive_reply THEN id END) as accounts_with_replies,
        COUNT(DISTINCT CASE WHEN has_sign_up THEN id END) as accounts_with_signups,
        COUNT(DISTINCT CASE WHEN has_meeting_booked THEN id END) as accounts_with_meetings,
        COUNT(DISTINCT CASE WHEN has_paying_customer THEN id END) as accounts_with_paying,
        -- Attributed accounts (within window, matched)
        COUNT(DISTINCT CASE WHEN has_positive_reply AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_replies,
        COUNT(DISTINCT CASE WHEN has_sign_up AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_signups,
        COUNT(DISTINCT CASE WHEN has_meeting_booked AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_meetings,
        COUNT(DISTINCT CASE WHEN has_paying_customer AND is_within_window AND status IN ('ATTRIBUTED', 'MANUAL', 'CLIENT_PROMOTED') THEN id END) as attributed_accounts_paying,
        -- Outside window accounts
        COUNT(DISTINCT CASE WHEN has_sign_up AND NOT is_within_window AND match_type != 'NO_MATCH' THEN id END) as outside_accounts_signups,
        COUNT(DISTINCT CASE WHEN has_meeting_booked AND NOT is_within_window AND match_type != 'NO_MATCH' THEN id END) as outside_accounts_meetings,
        COUNT(DISTINCT CASE WHEN has_paying_customer AND NOT is_within_window AND match_type != 'NO_MATCH' THEN id END) as outside_accounts_paying,
        -- Unattributed accounts (no match)
        COUNT(DISTINCT CASE WHEN has_sign_up AND match_type = 'NO_MATCH' THEN id END) as unattributed_accounts_signups,
        COUNT(DISTINCT CASE WHEN has_meeting_booked AND match_type = 'NO_MATCH' THEN id END) as unattributed_accounts_meetings,
        COUNT(DISTINCT CASE WHEN has_paying_customer AND match_type = 'NO_MATCH' THEN id END) as unattributed_accounts_paying
      FROM attributed_domain
      WHERE client_config_id = $1
    `;
    
    const accountCountsRows = await attrQuery<{
      accounts_with_replies: string;
      accounts_with_signups: string;
      accounts_with_meetings: string;
      accounts_with_paying: string;
      attributed_accounts_replies: string;
      attributed_accounts_signups: string;
      attributed_accounts_meetings: string;
      attributed_accounts_paying: string;
      outside_accounts_signups: string;
      outside_accounts_meetings: string;
      outside_accounts_paying: string;
      unattributed_accounts_signups: string;
      unattributed_accounts_meetings: string;
      unattributed_accounts_paying: string;
    }>(accountCountsQuery, [client.id]);
    
    const accountRow = accountCountsRows[0];
    const accountStats: AccountStats = {
      totalAccountsWithReplies: parseInt(accountRow?.accounts_with_replies || '0', 10),
      totalAccountsWithSignUps: parseInt(accountRow?.accounts_with_signups || '0', 10),
      totalAccountsWithMeetings: parseInt(accountRow?.accounts_with_meetings || '0', 10),
      totalAccountsWithPaying: parseInt(accountRow?.accounts_with_paying || '0', 10),
      attributedAccountsWithReplies: parseInt(accountRow?.attributed_accounts_replies || '0', 10),
      attributedAccountsWithSignUps: parseInt(accountRow?.attributed_accounts_signups || '0', 10),
      attributedAccountsWithMeetings: parseInt(accountRow?.attributed_accounts_meetings || '0', 10),
      attributedAccountsWithPaying: parseInt(accountRow?.attributed_accounts_paying || '0', 10),
      outsideWindowAccountsWithSignUps: parseInt(accountRow?.outside_accounts_signups || '0', 10),
      outsideWindowAccountsWithMeetings: parseInt(accountRow?.outside_accounts_meetings || '0', 10),
      outsideWindowAccountsWithPaying: parseInt(accountRow?.outside_accounts_paying || '0', 10),
      unattributedAccountsWithSignUps: parseInt(accountRow?.unattributed_accounts_signups || '0', 10),
      unattributedAccountsWithMeetings: parseInt(accountRow?.unattributed_accounts_meetings || '0', 10),
      unattributedAccountsWithPaying: parseInt(accountRow?.unattributed_accounts_paying || '0', 10),
    };

    // Build stats object
    const stats: FilteredStats = {
      totalEmailsSent: totalEmailsSent,
      attributedPositiveReplies: 0,
      attributedSignUps: 0,
      attributedMeetings: 0,
      attributedPaying: 0,
      hardMatchPositiveReplies: 0,
      hardMatchSignUps: 0,
      hardMatchMeetings: 0,
      hardMatchPaying: 0,
      softMatchPositiveReplies: 0,
      softMatchSignUps: 0,
      softMatchMeetings: 0,
      softMatchPaying: 0,
      outsideWindowSignUps: 0,
      outsideWindowMeetings: 0,
      outsideWindowPaying: 0,
      notMatchedSignUps: 0,
      notMatchedMeetings: 0,
      notMatchedPaying: 0,
    };

    // Process attributed results
    for (const row of attributedRows) {
      const count = parseInt(row.count, 10);
      const isHard = row.match_type === 'HARD_MATCH';
      
      switch (row.event_source) {
        case 'POSITIVE_REPLY':
          stats.attributedPositiveReplies += count;
          if (isHard) stats.hardMatchPositiveReplies += count;
          else stats.softMatchPositiveReplies += count;
          break;
        case 'SIGN_UP':
          stats.attributedSignUps += count;
          if (isHard) stats.hardMatchSignUps += count;
          else stats.softMatchSignUps += count;
          break;
        case 'MEETING_BOOKED':
          stats.attributedMeetings += count;
          if (isHard) stats.hardMatchMeetings += count;
          else stats.softMatchMeetings += count;
          break;
        case 'PAYING_CUSTOMER':
          stats.attributedPaying += count;
          if (isHard) stats.hardMatchPaying += count;
          else stats.softMatchPaying += count;
          break;
      }
    }

    // Process outside window results
    for (const row of outsideWindowRows) {
      const count = parseInt(row.count, 10);
      switch (row.event_source) {
        case 'SIGN_UP':
          stats.outsideWindowSignUps += count;
          break;
        case 'MEETING_BOOKED':
          stats.outsideWindowMeetings += count;
          break;
        case 'PAYING_CUSTOMER':
          stats.outsideWindowPaying += count;
          break;
      }
    }

    // Process unmatched results
    for (const row of unmatchedRows) {
      const count = parseInt(row.count, 10);
      switch (row.event_source) {
        case 'SIGN_UP':
          stats.notMatchedSignUps += count;
          break;
        case 'MEETING_BOOKED':
          stats.notMatchedMeetings += count;
          break;
        case 'PAYING_CUSTOMER':
          stats.notMatchedPaying += count;
          break;
      }
    }

    return NextResponse.json({
      stats,
      accountStats,
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching filtered stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch stats', 
        details: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 5),
      },
      { status: 500 }
    );
  }
}

