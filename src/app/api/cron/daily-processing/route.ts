// Daily Processing Cron Endpoint
// Called by Vercel Cron at 2 AM Pacific (10 AM UTC)

import { NextRequest, NextResponse } from 'next/server';
import { PgBoss } from 'pg-boss';
import { getAllClientConfigs, logToDb } from '@/db/attribution/queries';

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const boss = new PgBoss(process.env.ATTR_DATABASE_URL!);
    await boss.start();

    // Queue processing for all clients
    const clients = await getAllClientConfigs();
    
    for (const client of clients) {
      await boss.send('process-single-client', { clientId: client.client_id }, {
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
      });
    }

    await logToDb({
      level: 'INFO',
      source: 'cron',
      message: `Daily processing: Queued ${clients.length} clients`,
      context: { clientCount: clients.length },
    });

    await boss.stop();

    return NextResponse.json({
      success: true,
      message: `Queued ${clients.length} clients for processing`,
    });
  } catch (error) {
    console.error('Daily processing cron error:', error);
    
    await logToDb({
      level: 'ERROR',
      source: 'cron',
      message: `Daily processing failed: ${(error as Error).message}`,
      context: { error: (error as Error).message },
    });

    return NextResponse.json(
      { error: 'Cron job failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
