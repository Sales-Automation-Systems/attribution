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
    if (!startDate && !endDate) {
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

    // Build stats object
    const stats: FilteredStats = {
      totalEmailsSent: Number(client.total_emails_sent || 0), // Emails sent is not filtered by event date
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
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching filtered stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: (error as Error).message },
      { status: 500 }
    );
  }
}

