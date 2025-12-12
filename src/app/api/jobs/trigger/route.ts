// Job Trigger API
// Proxies requests to Railway worker

import { NextRequest, NextResponse } from 'next/server';
import { logToDb } from '@/db/attribution/queries';

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3001';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, jobType, clientId } = body;

    const requestedAction = action || jobType;

    if (!requestedAction) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    await logToDb({
      level: 'INFO',
      source: 'api',
      message: `Triggering action: ${requestedAction}`,
      context: { clientId },
    });

    let endpoint: string;
    let fetchBody: Record<string, unknown> = {};

    switch (requestedAction) {
      case 'sync-clients':
      case 'sync-new-clients':
        endpoint = '/sync-clients';
        break;

      case 'process-client':
      case 'process-single-client':
        if (!clientId) {
          return NextResponse.json(
            { error: 'clientId is required for process-client' },
            { status: 400 }
          );
        }
        endpoint = '/process-client';
        fetchBody = { clientId };
        break;

      case 'process-all-clients':
        endpoint = '/process-all';
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${requestedAction}` }, { status: 400 });
    }

    // Call Railway worker
    const workerResponse = await fetch(`${WORKER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fetchBody),
    });

    const result = await workerResponse.json();

    if (!workerResponse.ok) {
      await logToDb({
        level: 'ERROR',
        source: 'api',
        message: `Worker returned error: ${result.error}`,
        context: { action: requestedAction, statusCode: workerResponse.status },
      });

      return NextResponse.json(
        { error: result.error || 'Worker request failed' },
        { status: workerResponse.status }
      );
    }

    await logToDb({
      level: 'INFO',
      source: 'api',
      message: `Action completed: ${requestedAction}`,
      context: { result },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in job trigger:', error);

    await logToDb({
      level: 'ERROR',
      source: 'api',
      message: `Job trigger failed: ${(error as Error).message}`,
      context: { error: (error as Error).stack },
    }).catch(() => {});

    return NextResponse.json(
      { error: 'Failed to execute job', details: (error as Error).message },
      { status: 500 }
    );
  }
}
