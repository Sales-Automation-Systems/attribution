// Railway Background Worker
// Processes attribution jobs using pg-boss

import { PgBoss } from 'pg-boss';
import { attrPool, prodPool, closePools } from '@/db';
import { processClientAttributions, syncNewClientsFromProduction } from '@/lib/attribution/processor';
import { updateWorkerHeartbeat, logToDb, getAllClientConfigs } from '@/db/attribution/queries';

let boss: PgBoss;
let currentStatus: 'running' | 'idle' | 'processing' = 'idle';
let currentJobId: string | null = null;

async function main() {
  console.log('Starting Attribution Worker...');

  // Initialize pg-boss with connection string
  boss = new PgBoss(process.env.ATTR_DATABASE_URL!);

  boss.on('error', async (error) => {
    console.error('pg-boss error:', error);
    await logToDb({
      level: 'ERROR',
      source: 'worker',
      message: `pg-boss error: ${error.message}`,
      context: { stack: error.stack },
    });
  });

  await boss.start();
  console.log('pg-boss started');

  // Start heartbeat
  startHeartbeat();

  // Register job handlers
  await registerJobHandlers();

  console.log('Worker ready, waiting for jobs...');
  currentStatus = 'running';

  // Handle graceful shutdown
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

async function registerJobHandlers() {
  // Process a single client
  await boss.work('process-single-client', { batchSize: 1 }, async ([job]) => {
    currentStatus = 'processing';
    currentJobId = job.id;

    const data = job.data as { clientId: string };
    console.log(`Processing client: ${data.clientId}`);
    
    try {
      const stats = await processClientAttributions(data.clientId, (progress) => {
        console.log(`Progress: ${progress.processedEvents}/${progress.totalEvents} events`);
      });
      
      console.log(`Completed: ${stats.processedEvents} events processed`);
      console.log(`  Hard matches: ${stats.matchedHard}`);
      console.log(`  Soft matches: ${stats.matchedSoft}`);
      console.log(`  No match: ${stats.noMatch}`);
      console.log(`  Errors: ${stats.errors}`);
      
      return stats;
    } finally {
      currentStatus = 'running';
      currentJobId = null;
    }
  });

  // Process all clients
  await boss.work('process-all-clients', { batchSize: 1 }, async () => {
    currentStatus = 'processing';
    console.log('Processing all clients...');

    try {
      const clients = await getAllClientConfigs();
      console.log(`Found ${clients.length} clients to process`);

      for (const client of clients) {
        await boss.send('process-single-client', { clientId: client.client_id }, {
          retryLimit: 3,
          retryDelay: 30,
          retryBackoff: true,
        });
        console.log(`Queued: ${client.client_name}`);
      }

      return { queuedClients: clients.length };
    } finally {
      currentStatus = 'running';
    }
  });

  // Sync new clients from production
  await boss.work('sync-new-clients', { batchSize: 1 }, async () => {
    currentStatus = 'processing';
    console.log('Syncing new clients from production...');

    try {
      const newClients = await syncNewClientsFromProduction();
      
      if (newClients.length > 0) {
        console.log(`Created configs for ${newClients.length} new clients:`, newClients);
      } else {
        console.log('No new clients found');
      }

      return { newClients };
    } finally {
      currentStatus = 'running';
    }
  });

  // Create reconciliation periods (monthly)
  await boss.work('create-reconciliation-periods', { batchSize: 1 }, async () => {
    currentStatus = 'processing';
    console.log('Creating reconciliation periods...');

    try {
      const { createReconciliationPeriod } = await import('@/db/attribution/queries');
      const clients = await getAllClientConfigs();

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 1-12

      // Set deadline to 10th of the month, 11:59:59 PM Pacific
      const deadline = new Date(year, month - 1, 10, 23, 59, 59);

      let created = 0;
      for (const client of clients) {
        const period = await createReconciliationPeriod({
          client_config_id: client.id,
          year,
          month,
          deadline,
          rev_share_rate: client.rev_share_rate,
        });
        
        if (period) {
          created++;
        }
      }

      console.log(`Created ${created} reconciliation periods for ${year}-${month}`);
      return { created, year, month };
    } finally {
      currentStatus = 'running';
    }
  });
}

function startHeartbeat() {
  // Send heartbeat every 30 seconds
  setInterval(async () => {
    try {
      await updateWorkerHeartbeat(currentStatus, currentJobId || undefined);
    } catch (error) {
      console.error('Failed to update heartbeat:', error);
    }
  }, 30000);

  // Initial heartbeat
  updateWorkerHeartbeat(currentStatus, currentJobId || undefined);
}

async function handleShutdown() {
  console.log('Shutting down worker...');
  currentStatus = 'idle';

  try {
    await boss.stop({ graceful: true, timeout: 30000 });
    console.log('pg-boss stopped');
  } catch (error) {
    console.error('Error stopping pg-boss:', error);
  }

  try {
    await closePools();
    console.log('Database pools closed');
  } catch (error) {
    console.error('Error closing pools:', error);
  }

  process.exit(0);
}

// Run the worker
main().catch(async (error) => {
  console.error('Worker failed to start:', error);
  
  await logToDb({
    level: 'ERROR',
    source: 'worker',
    message: `Worker startup failed: ${error.message}`,
    context: { stack: error.stack },
  }).catch(console.error);

  process.exit(1);
});
