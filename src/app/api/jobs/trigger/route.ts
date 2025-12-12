// Job Trigger API
// Allows manual triggering of background jobs

import { NextRequest, NextResponse } from 'next/server';
import { getAllClientConfigs, logToDb, getOrCreateProcessingJob } from '@/db/attribution/queries';
import { syncNewClientsFromProduction, processClientAttributions } from '@/lib/attribution/processor';

export const maxDuration = 60; // Allow up to 60 seconds for Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, jobType, clientId } = body;

    // Support both "action" and "jobType" for backwards compatibility
    const requestedAction = action || jobType;

    if (!requestedAction) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let result: Record<string, unknown> = {};

    switch (requestedAction) {
      case 'sync-clients':
      case 'sync-new-clients': {
        // Run sync directly (not via pg-boss) for immediate feedback
        await logToDb({
          level: 'INFO',
          source: 'api',
          message: 'Starting client sync',
        });

        const newClients = await syncNewClientsFromProduction();

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Client sync completed. ${newClients.length} new clients added.`,
          context: { newClients },
        });

        result = { 
          success: true, 
          newClients,
          message: `Synced ${newClients.length} new clients`
        };
        break;
      }

      case 'process-single-client': {
        if (!clientId) {
          return NextResponse.json(
            { error: 'clientId is required for process-single-client' },
            { status: 400 }
          );
        }

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Starting processing for client: ${clientId}`,
          context: { clientId },
        });

        // Process directly (this may timeout on large clients)
        const stats = await processClientAttributions(clientId);

        result = {
          success: true,
          clientId,
          stats,
        };
        break;
      }

      case 'process-all-clients': {
        const clients = await getAllClientConfigs();

        if (clients.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No clients found. Run "Sync Clients" first.',
          }, { status: 400 });
        }

        await logToDb({
          level: 'INFO',
          source: 'api',
          message: `Starting processing for all ${clients.length} clients`,
          context: { clientCount: clients.length },
        });

        // For MVP: Process clients sequentially
        // Note: This may timeout on Vercel for large datasets
        // For production: Use pg-boss + Railway worker
        const processedClients: string[] = [];
        const errors: Array<{ clientName: string; error: string }> = [];

        for (const client of clients) {
          try {
            // Create job record for tracking
            await getOrCreateProcessingJob(client.id);
            
            await processClientAttributions(client.client_id);
            processedClients.push(client.client_name);
          } catch (error) {
            errors.push({
              clientName: client.client_name,
              error: (error as Error).message,
            });
          }
        }

        result = {
          success: true,
          clientCount: clients.length,
          processedClients,
          errors: errors.length > 0 ? errors : undefined,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${requestedAction}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in job trigger:', error);

    await logToDb({
      level: 'ERROR',
      source: 'api',
      message: `Job trigger failed: ${(error as Error).message}`,
      context: { error: (error as Error).stack },
    }).catch(() => {}); // Don't fail if logging fails

    return NextResponse.json(
      { error: 'Failed to execute job', details: (error as Error).message },
      { status: 500 }
    );
  }
}
