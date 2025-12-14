import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';
import * as fs from 'fs';
import * as path from 'path';

// This endpoint runs a specific migration file
// Only for admin use - should be protected in production
export async function POST(request: NextRequest) {
  try {
    const { migrationFile } = await request.json();
    
    if (!migrationFile) {
      return NextResponse.json({ error: 'migrationFile is required' }, { status: 400 });
    }

    // Sanitize: only allow specific migration file names
    if (!migrationFile.match(/^\d{3}_[a-z_]+\.sql$/)) {
      return NextResponse.json({ error: 'Invalid migration file name format' }, { status: 400 });
    }

    // For Vercel, we'll inline the SQL since fs access is limited
    // This is specifically for 012_last_event_at.sql
    const migrations: Record<string, string> = {
      '012_last_event_at.sql': `
        -- Add last_event_at column
        ALTER TABLE attributed_domain 
        ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMP WITH TIME ZONE;

        -- Initially populate from first_event_at (will be updated by worker on next run)
        UPDATE attributed_domain 
        SET last_event_at = first_event_at 
        WHERE last_event_at IS NULL AND first_event_at IS NOT NULL;

        -- Add index for sorting by most recent activity
        CREATE INDEX IF NOT EXISTS idx_attributed_domain_last_event_at 
        ON attributed_domain(last_event_at DESC NULLS LAST);

        -- Add comment for documentation
        COMMENT ON COLUMN attributed_domain.last_event_at IS 'Timestamp of the most recent event (reply, sign-up, meeting, or paying) for this domain';
      `,
    };

    const sql = migrations[migrationFile];
    if (!sql) {
      return NextResponse.json({ error: `Migration ${migrationFile} not found` }, { status: 404 });
    }

    console.log(`Running migration: ${migrationFile}`);
    
    // Split by semicolons and run each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      await attrPool.query(statement);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Migration ${migrationFile} completed successfully`,
      statementsRun: statements.length 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

