// Debug Jobs API

import { NextRequest, NextResponse } from 'next/server';
import { getProcessingJobs, getAllClientConfigs } from '@/db/attribution/queries';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const jobs = await getProcessingJobs({ status, limit });
    const clients = await getAllClientConfigs();
    const clientMap = new Map(clients.map((c) => [c.id, c.client_name]));

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        clientConfigId: j.client_config_id,
        clientName: j.client_config_id ? clientMap.get(j.client_config_id) : null,
        jobType: j.job_type,
        status: j.status,
        totalEvents: j.total_events,
        processedEvents: j.processed_events,
        matchedHard: j.matched_hard,
        matchedSoft: j.matched_soft,
        noMatch: j.no_match,
        lastProcessedEventId: j.last_processed_event_id,
        lastCheckpointAt: j.last_checkpoint_at?.toISOString(),
        startedAt: j.started_at?.toISOString(),
        completedAt: j.completed_at?.toISOString(),
        errorMessage: j.error_message,
        createdAt: j.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: (error as Error).message },
      { status: 500 }
    );
  }
}



