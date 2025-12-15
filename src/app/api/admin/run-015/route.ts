import { NextResponse } from 'next/server';
import { attrPool } from '@/db';

// Temporary one-time endpoint to run migration 015
export async function POST() {
  try {
    // Create job_log table
    await attrPool.query(`
      CREATE TABLE IF NOT EXISTS job_log (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(100) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        level VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await attrPool.query(`
      CREATE INDEX IF NOT EXISTS idx_job_log_job_id ON job_log(job_id)
    `);
    
    await attrPool.query(`
      CREATE INDEX IF NOT EXISTS idx_job_log_job_id_timestamp ON job_log(job_id, timestamp DESC)
    `);

    // Add phase column to worker_job
    await attrPool.query(`
      ALTER TABLE worker_job ADD COLUMN IF NOT EXISTS phase VARCHAR(100)
    `);

    return NextResponse.json({ 
      success: true, 
      message: 'Migration 015_job_logging completed successfully' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

