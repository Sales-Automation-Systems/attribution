// Sync Clients Cron Endpoint
// Called by Vercel Cron every hour - triggers Railway worker

import { NextRequest, NextResponse } from 'next/server';
import { logToDb } from '@/db/attribution/queries';

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const workerUrl = process.env.WORKER_URL;
    if (!workerUrl) {
      throw new Error('WORKER_URL environment variable is not set');
    }

    const response = await fetch(`${workerUrl}/trigger-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobType: 'sync-new-clients' }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Worker request failed');
    }

    await logToDb({
      level: 'INFO',
      source: 'cron',
      message: 'Triggered sync-new-clients via worker',
      context: result,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Sync clients cron error:', error);
    
    await logToDb({
      level: 'ERROR',
      source: 'cron',
      message: `Sync clients failed: ${(error as Error).message}`,
      context: { error: (error as Error).message },
    });

    return NextResponse.json(
      { error: 'Cron job failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
