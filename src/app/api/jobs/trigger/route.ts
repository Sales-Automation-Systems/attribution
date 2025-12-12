// Job Trigger API
// Allows manual triggering of background jobs

import { NextRequest, NextResponse } from 'next/server';
import { PgBoss } from 'pg-boss';
import { getAllClientConfigs, logToDb } from '@/db/attribution/queries';

let boss: PgBoss | null = null;

async function getPgBossInstance(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.ATTR_DATABASE_URL!);
    await boss.start();
  }
  return boss;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobType, clientId } = body;

    if (!jobType) {
      return NextResponse.json({ error: 'jobType is required' }, { status: 400 });
    }

    const pgBoss = await getPgBossInstance();
    let result: { jobId?: string; queuedClients?: number } = {};

    switch (jobType) {
      case 'process-single-client':
        if (!clientId) {
          return NextResponse.json(
            { error: 'clientId is required for process-single-client' },
            { status: 400 }
          );
        }
        const singleJobId = await pgBoss.send('process-single-client', { clientId }, {
          retryLimit: 3,
          retryDelay: 30,
          retryBackoff: true,
        });
        result = { jobId: singleJobId || undefined };

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Triggered process-single-client job`,
          context: { clientId, jobId: singleJobId },
        });
        break;

      case 'process-all-clients':
        const clients = await getAllClientConfigs();
        for (const client of clients) {
          await pgBoss.send('process-single-client', { clientId: client.client_id }, {
            retryLimit: 3,
            retryDelay: 30,
            retryBackoff: true,
          });
        }
        result = { queuedClients: clients.length };

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Triggered process-all-clients job`,
          context: { queuedClients: clients.length },
        });
        break;

      case 'sync-new-clients':
        const syncJobId = await pgBoss.send('sync-new-clients', {});
        result = { jobId: syncJobId || undefined };

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Triggered sync-new-clients job`,
          context: { jobId: syncJobId },
        });
        break;

      case 'create-reconciliation-periods':
        const reconcileJobId = await pgBoss.send('create-reconciliation-periods', {});
        result = { jobId: reconcileJobId || undefined };

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Triggered create-reconciliation-periods job`,
          context: { jobId: reconcileJobId },
        });
        break;

      default:
        return NextResponse.json({ error: `Unknown job type: ${jobType}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error triggering job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger job', details: (error as Error).message },
      { status: 500 }
    );
  }
}
