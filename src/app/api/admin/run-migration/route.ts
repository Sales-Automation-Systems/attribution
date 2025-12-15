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
    const migrations: Record<string, string> = {
      '011_client_actions.sql': `
        -- Add promotion tracking fields to attributed_domain
        ALTER TABLE attributed_domain 
        ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS promoted_by VARCHAR(255),
        ADD COLUMN IF NOT EXISTS promotion_notes TEXT;

        -- Add index for finding promoted domains
        CREATE INDEX IF NOT EXISTS idx_attributed_domain_promoted_at 
        ON attributed_domain(promoted_at) 
        WHERE promoted_at IS NOT NULL;

        -- Add composite index for client + status queries
        CREATE INDEX IF NOT EXISTS idx_attributed_domain_client_status 
        ON attributed_domain(client_config_id, status);

        -- Add comments for documentation
        COMMENT ON COLUMN attributed_domain.promoted_at IS 'Timestamp when client promoted this domain to attributed status';
        COMMENT ON COLUMN attributed_domain.promoted_by IS 'Email or user ID of who promoted this domain';
        COMMENT ON COLUMN attributed_domain.promotion_notes IS 'Optional notes provided when promoting';
      `,
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
      '013_matched_emails_array.sql': `
        -- Add new array column for multiple matched emails
        ALTER TABLE attributed_domain ADD COLUMN IF NOT EXISTS matched_emails TEXT[];

        -- Backfill from existing matched_email column
        UPDATE attributed_domain 
        SET matched_emails = ARRAY[matched_email] 
        WHERE matched_email IS NOT NULL AND matched_emails IS NULL;

        -- Add GIN index for efficient array queries
        CREATE INDEX IF NOT EXISTS idx_attributed_domain_matched_emails 
        ON attributed_domain USING GIN(matched_emails);

        -- Add comment for documentation
        COMMENT ON COLUMN attributed_domain.matched_emails IS 'Array of email addresses that were hard-matched (exact email we contacted had success events)';
      `,
      '014_task_system.sql': `
        -- Core task/dispute table
        CREATE TABLE IF NOT EXISTS task (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_config_id UUID NOT NULL REFERENCES client_config(id) ON DELETE CASCADE,
          attributed_domain_id UUID REFERENCES attributed_domain(id) ON DELETE SET NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
          title VARCHAR(255),
          description TEXT,
          submitted_by VARCHAR(255),
          submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          resolved_by VARCHAR(255),
          resolved_at TIMESTAMP WITH TIME ZONE,
          resolution_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Comments/correspondence on tasks
        CREATE TABLE IF NOT EXISTS task_comment (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
          author_type VARCHAR(20) NOT NULL,
          author_name VARCHAR(255),
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Indexes for efficient queries
        CREATE INDEX IF NOT EXISTS idx_task_client_config_id ON task(client_config_id);
        CREATE INDEX IF NOT EXISTS idx_task_status ON task(status);
        CREATE INDEX IF NOT EXISTS idx_task_type ON task(type);
        CREATE INDEX IF NOT EXISTS idx_task_submitted_at ON task(submitted_at DESC);
        CREATE INDEX IF NOT EXISTS idx_task_attributed_domain_id ON task(attributed_domain_id);
        CREATE INDEX IF NOT EXISTS idx_task_comment_task_id ON task_comment(task_id);
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

