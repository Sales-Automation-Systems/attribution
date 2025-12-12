// Batch Processing Logic
// Handles processing attribution events in batches with checkpointing

import {
  getAttributionEvents,
  countAttributionEvents,
  getAllActiveClients,
} from '@/db/production/queries';
import {
  getClientConfigByClientId,
  createClientConfig,
  getOrCreateProcessingJob,
  startProcessingJob,
  updateProcessingJobProgress,
  completeProcessingJob,
  failProcessingJob,
  logEventError,
  logToDb,
} from '@/db/attribution/queries';
import { processAttributionEvent, type MatchResult } from './matcher';
import { slugify } from './domain-utils';

const BATCH_SIZE = 1000;
const BATCH_DELAY_MS = 100;

interface ProcessingStats {
  totalEvents: number;
  processedEvents: number;
  matchedHard: number;
  matchedSoft: number;
  noMatch: number;
  errors: number;
}

/**
 * Process all attribution events for a single client
 */
export async function processClientAttributions(
  clientId: string,
  onProgress?: (stats: ProcessingStats) => void
): Promise<ProcessingStats> {
  // Get or create client config
  let clientConfig = await getClientConfigByClientId(clientId);
  if (!clientConfig) {
    // Need to create client config first
    const clients = await getAllActiveClients();
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    clientConfig = await createClientConfig({
      client_id: clientId,
      client_name: client.client_name,
      slug: slugify(client.client_name),
    });
  }

  // Get or create processing job
  const processingJob = await getOrCreateProcessingJob(clientConfig.id);

  // Count total events
  const totalEvents = await countAttributionEvents(clientId);

  // Start the job
  await startProcessingJob(processingJob.id, totalEvents);

  await logToDb({
    level: 'INFO',
    source: 'worker',
    message: `Starting attribution processing for ${clientConfig.client_name}`,
    context: { clientId, totalEvents },
    client_config_id: clientConfig.id,
    processing_job_id: processingJob.id,
  });

  const stats: ProcessingStats = {
    totalEvents,
    processedEvents: 0,
    matchedHard: 0,
    matchedSoft: 0,
    noMatch: 0,
    errors: 0,
  };

  let lastEventId = processingJob.last_processed_event_id || undefined;
  let batchNumber = processingJob.current_batch || 0;

  try {
    // Process in batches
    while (true) {
      const events = await getAttributionEvents(clientId, lastEventId, BATCH_SIZE);

      if (events.length === 0) {
        break; // All done
      }

      batchNumber++;

      // Process each event in the batch
      for (const event of events) {
        try {
          const result = await processAttributionEvent(event);

          // Update stats based on result
          if (result.matchType === 'HARD_MATCH') {
            stats.matchedHard++;
          } else if (result.matchType === 'SOFT_MATCH') {
            stats.matchedSoft++;
          } else {
            stats.noMatch++;
          }

          stats.processedEvents++;
          lastEventId = event.id;
        } catch (error) {
          stats.errors++;
          await logEventError({
            processing_job_id: processingJob.id,
            attribution_event_id: event.id,
            error_message: (error as Error).message,
            error_stack: (error as Error).stack,
          });

          // Still advance past the failed event
          lastEventId = event.id;
          stats.processedEvents++;
        }
      }

      // Checkpoint progress after each batch
      await updateProcessingJobProgress(processingJob.id, {
        processed_events: stats.processedEvents,
        matched_hard: stats.matchedHard,
        matched_soft: stats.matchedSoft,
        no_match: stats.noMatch,
        last_processed_event_id: lastEventId!,
        current_batch: batchNumber,
      });

      // Callback for progress updates
      if (onProgress) {
        onProgress(stats);
      }

      // Brief pause to avoid hammering the database
      await sleep(BATCH_DELAY_MS);
    }

    // Mark job as complete
    await completeProcessingJob(processingJob.id);

    await logToDb({
      level: 'INFO',
      source: 'worker',
      message: `Completed attribution processing for ${clientConfig.client_name}`,
      context: { ...stats },
      client_config_id: clientConfig.id,
      processing_job_id: processingJob.id,
    });

    return stats;
  } catch (error) {
    // Mark job as failed
    await failProcessingJob(processingJob.id, (error as Error).message);

    await logToDb({
      level: 'ERROR',
      source: 'worker',
      message: `Failed attribution processing for ${clientConfig.client_name}: ${(error as Error).message}`,
      context: { ...stats, error: (error as Error).message },
      client_config_id: clientConfig.id,
      processing_job_id: processingJob.id,
    });

    throw error;
  }
}

/**
 * Process positive replies for a client
 * Positive replies are handled differently - they have no 31-day window
 */
export async function processPositiveReplies(clientId: string): Promise<number> {
  const { getPositiveReplies } = await import('@/db/production/queries');
  const { upsertAttributedDomain, createDomainEvent } = await import(
    '@/db/attribution/queries'
  );
  const { normalizeDomain, extractDomain, formatAttributionMonth } = await import(
    './domain-utils'
  );

  const clientConfig = await getClientConfigByClientId(clientId);
  if (!clientConfig) {
    throw new Error(`Client not configured: ${clientId}`);
  }

  const positiveProspects = await getPositiveReplies(clientId);
  let processed = 0;

  for (const prospect of positiveProspects) {
    const domain = normalizeDomain(
      prospect.company_domain || extractDomain(prospect.lead_email)
    );

    if (!domain) continue;

    // Upsert attributed domain with positive reply flag
    const attributedDomain = await upsertAttributedDomain({
      client_config_id: clientConfig.id,
      domain,
      first_event_at: prospect.last_interaction_time || undefined,
      first_attributed_month: prospect.last_interaction_time
        ? formatAttributionMonth(prospect.last_interaction_time)
        : undefined,
      has_positive_reply: true,
      is_within_window: true, // Positive replies always count
      match_type: 'HARD_MATCH', // We emailed this exact person
    });

    // Add to timeline
    if (prospect.last_interaction_time) {
      await createDomainEvent({
        attributed_domain_id: attributedDomain.id,
        event_source: 'POSITIVE_REPLY',
        event_time: prospect.last_interaction_time,
        email: prospect.lead_email,
        source_id: prospect.id,
        source_table: 'prospect',
        metadata: { category: prospect.category_name },
      });
    }

    processed++;
  }

  return processed;
}

/**
 * Sync new clients from production database
 */
export async function syncNewClientsFromProduction(): Promise<string[]> {
  const { getAllActiveClients } = await import('@/db/production/queries');
  const { getAllClientConfigs, createClientConfig, logToDb } = await import(
    '@/db/attribution/queries'
  );

  const productionClients = await getAllActiveClients();
  const existingConfigs = await getAllClientConfigs();
  const existingClientIds = new Set(existingConfigs.map((c) => c.client_id));

  const newClients: string[] = [];

  for (const client of productionClients) {
    if (!existingClientIds.has(client.id)) {
      await createClientConfig({
        client_id: client.id,
        client_name: client.client_name,
        slug: slugify(client.client_name),
      });

      newClients.push(client.client_name);

      await logToDb({
        level: 'INFO',
        source: 'cron',
        message: `Created client config for: ${client.client_name}`,
        context: { clientId: client.id },
      });
    }
  }

  return newClients;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

