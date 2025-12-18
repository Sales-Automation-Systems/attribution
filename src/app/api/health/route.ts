// Health Check API
// Returns system status for monitoring

import { NextResponse } from 'next/server';
import { prodPool, attrPool } from '@/db';
import { getWorkerHeartbeat, getProcessingJobs, getRecentLogs } from '@/db/attribution/queries';

export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    databases: {
      production: { status: string; latencyMs?: number; error?: string };
      attribution: { status: string; latencyMs?: number; error?: string };
    };
    worker: {
      status: string;
      lastHeartbeat?: string;
      currentJobId?: string;
      isHealthy?: boolean;
    };
    queues: {
      running: number;
      pending: number;
      failed: number;
    };
    recentErrors: Array<{
      message: string;
      source: string;
      createdAt: string;
    }>;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    databases: {
      production: { status: 'unknown' },
      attribution: { status: 'unknown' },
    },
    worker: { status: 'unknown' },
    queues: { running: 0, pending: 0, failed: 0 },
    recentErrors: [],
  };

  // Test production database
  try {
    const start = Date.now();
    await prodPool.query('SELECT 1');
    health.databases.production = {
      status: 'connected',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    health.databases.production = {
      status: 'error',
      error: (error as Error).message,
    };
    health.status = 'degraded';
  }

  // Test attribution database
  try {
    const start = Date.now();
    await attrPool.query('SELECT 1');
    health.databases.attribution = {
      status: 'connected',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    health.databases.attribution = {
      status: 'error',
      error: (error as Error).message,
    };
    health.status = 'unhealthy';
  }

  // Check worker heartbeat
  try {
    const heartbeat = await getWorkerHeartbeat();
    if (heartbeat) {
      health.worker = {
        status: heartbeat.status,
        lastHeartbeat: heartbeat.last_heartbeat.toISOString(),
        currentJobId: heartbeat.current_job_id || undefined,
        isHealthy: heartbeat.is_healthy,
      };
      if (!heartbeat.is_healthy) {
        health.status = 'degraded';
      }
    } else {
      health.worker = { status: 'not_started' };
    }
  } catch (error) {
    health.worker = { status: 'error' };
  }

  // Check job queue status
  try {
    const [running, pending, failed] = await Promise.all([
      getProcessingJobs({ status: 'RUNNING', limit: 100 }),
      getProcessingJobs({ status: 'PENDING', limit: 100 }),
      getProcessingJobs({ status: 'FAILED', limit: 100 }),
    ]);
    health.queues = {
      running: running.length,
      pending: pending.length,
      failed: failed.length,
    };
    if (failed.length > 0) {
      health.status = 'degraded';
    }
  } catch {
    // Queue check failed, already marked as unhealthy
  }

  // Get recent errors
  try {
    const errors = await getRecentLogs({ level: 'ERROR', limit: 5 });
    health.recentErrors = errors.map((e) => ({
      message: e.message,
      source: e.source,
      createdAt: e.created_at.toISOString(),
    }));
  } catch {
    // Error fetch failed
  }

  return NextResponse.json(health, {
    status: health.status === 'unhealthy' ? 503 : 200,
  });
}


