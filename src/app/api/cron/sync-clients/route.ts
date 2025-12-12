// Sync Clients Cron Endpoint
// Called by Vercel Cron every hour

import { NextRequest, NextResponse } from 'next/server';
import { PgBoss } from 'pg-boss';
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
    const boss = new PgBoss(process.env.ATTR_DATABASE_URL!);
    await boss.start();

    // Queue sync job
    const jobId = await boss.send('sync-new-clients', {});

    await logToDb({
      level: 'INFO',
      source: 'cron',
      message: 'Triggered sync-new-clients job',
      context: { jobId },
    });

    await boss.stop();

    return NextResponse.json({
      success: true,
      jobId,
    });
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
