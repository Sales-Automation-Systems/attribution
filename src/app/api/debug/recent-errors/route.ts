// Debug Recent Errors API

import { NextRequest, NextResponse } from 'next/server';
import { getRecentLogs } from '@/db/attribution/queries';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const errors = await getRecentLogs({ level: 'ERROR', limit });

    return NextResponse.json({
      errors: errors.map((e) => ({
        id: e.id,
        level: e.level,
        source: e.source,
        message: e.message,
        context: e.context,
        clientConfigId: e.client_config_id,
        processingJobId: e.processing_job_id,
        createdAt: e.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch errors', details: (error as Error).message },
      { status: 500 }
    );
  }
}



