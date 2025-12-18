import { NextRequest, NextResponse } from 'next/server';
import { attrPool } from '@/db';

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
      '015_job_logging.sql': `
        -- Real-time job logging table
        CREATE TABLE IF NOT EXISTS job_log (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          level VARCHAR(10) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Index for fetching logs by job
        CREATE INDEX IF NOT EXISTS idx_job_log_job_id ON job_log(job_id);
        CREATE INDEX IF NOT EXISTS idx_job_log_job_id_timestamp ON job_log(job_id, timestamp DESC);

        -- Add phase column to worker_job for more detailed progress tracking
        ALTER TABLE worker_job ADD COLUMN IF NOT EXISTS phase VARCHAR(100);
      `,
      '016_reconciliation.sql': `
        -- Billing model fields on client_config
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS billing_model VARCHAR(50) DEFAULT 'flat_revshare';
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS revshare_plg DECIMAL(5,4);
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS revshare_sales DECIMAL(5,4);
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS fee_per_signup DECIMAL(10,2);
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS fee_per_meeting DECIMAL(10,2);
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS reconciliation_interval VARCHAR(20) DEFAULT 'monthly';

        -- Reconciliation Period Table
        CREATE TABLE IF NOT EXISTS reconciliation_period (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_config_id UUID NOT NULL REFERENCES client_config(id) ON DELETE CASCADE,
          period_name VARCHAR(100) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
          created_by VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          sent_to_client_at TIMESTAMP WITH TIME ZONE,
          client_submitted_at TIMESTAMP WITH TIME ZONE,
          finalized_at TIMESTAMP WITH TIME ZONE,
          finalized_by VARCHAR(255),
          total_signups INTEGER DEFAULT 0,
          total_meetings INTEGER DEFAULT 0,
          total_paying_customers INTEGER DEFAULT 0,
          total_revenue_submitted DECIMAL(15,2) DEFAULT 0,
          total_amount_owed DECIMAL(15,2) DEFAULT 0,
          agency_notes TEXT,
          client_notes TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_recon_period_client ON reconciliation_period(client_config_id);
        CREATE INDEX IF NOT EXISTS idx_recon_period_status ON reconciliation_period(status);

        -- Reconciliation Line Item Table
        CREATE TABLE IF NOT EXISTS reconciliation_line_item (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reconciliation_period_id UUID NOT NULL REFERENCES reconciliation_period(id) ON DELETE CASCADE,
          attributed_domain_id UUID REFERENCES attributed_domain(id) ON DELETE SET NULL,
          domain VARCHAR(255) NOT NULL,
          motion_type VARCHAR(20),
          signup_count INTEGER DEFAULT 0,
          meeting_count INTEGER DEFAULT 0,
          revenue_submitted DECIMAL(15,2),
          revenue_submitted_at TIMESTAMP WITH TIME ZONE,
          revenue_notes TEXT,
          revshare_rate_applied DECIMAL(5,4),
          signup_fee_applied DECIMAL(10,2),
          meeting_fee_applied DECIMAL(10,2),
          amount_owed DECIMAL(15,2),
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          dispute_reason TEXT,
          dispute_submitted_at TIMESTAMP WITH TIME ZONE,
          resolution_notes TEXT,
          resolved_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_recon_item_period ON reconciliation_line_item(reconciliation_period_id);
        CREATE INDEX IF NOT EXISTS idx_recon_item_status ON reconciliation_line_item(status);
      `,
      '017_auto_reconciliation.sql': `
        -- Contract and billing fields on client_config
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS contract_start_date DATE;
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS estimated_acv DECIMAL(12,2) DEFAULT 10000;
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS review_window_days INTEGER DEFAULT 10;

        -- Auto-generation fields on reconciliation_period
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT true;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS review_deadline DATE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS auto_billed_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(15,2);

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_recon_period_deadline ON reconciliation_period(review_deadline) WHERE review_deadline IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_recon_period_auto_billed ON reconciliation_period(auto_billed_at) WHERE auto_billed_at IS NOT NULL;
      `,
      '018_reconciliation_schema_update.sql': `
        -- Add missing columns to reconciliation_period for flexible date-based periods
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS period_name VARCHAR(100);
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS start_date DATE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS end_date DATE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS client_submitted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS finalized_by VARCHAR(255);
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS total_signups INTEGER DEFAULT 0;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS total_meetings INTEGER DEFAULT 0;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS total_paying_customers INTEGER DEFAULT 0;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS total_revenue_submitted DECIMAL(15,2) DEFAULT 0;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS total_amount_owed DECIMAL(15,2) DEFAULT 0;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS agency_notes TEXT;
        ALTER TABLE reconciliation_period ADD COLUMN IF NOT EXISTS client_notes TEXT;
        
        -- Backfill period_name, start_date, end_date from year/month for existing records
        UPDATE reconciliation_period 
        SET period_name = to_char(make_date(year, month, 1), 'Month YYYY'),
            start_date = make_date(year, month, 1),
            end_date = (make_date(year, month, 1) + interval '1 month - 1 day')::date
        WHERE period_name IS NULL AND year IS NOT NULL AND month IS NOT NULL;
      `,
      '019_unique_constraints.sql': `
        -- Unique constraint on client + period_name for upserts (ignore if exists)
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_client_period_name ON reconciliation_period(client_config_id, period_name);
        
        -- Unique constraint on period + domain for line item upserts (ignore if exists)
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_period_domain ON reconciliation_line_item(reconciliation_period_id, domain);
      `,
      '020_custom_event.sql': `
        -- Add custom event fields to client_config
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS custom_event_name VARCHAR(100);
        ALTER TABLE client_config ADD COLUMN IF NOT EXISTS fee_per_custom_event DECIMAL(10,2);

        -- Add comments for documentation
        COMMENT ON COLUMN client_config.custom_event_name IS 'Custom billable event type name for this client (e.g., Proposal, HUD Agreement)';
        COMMENT ON COLUMN client_config.fee_per_custom_event IS 'Fee charged per custom event occurrence';
      `,
      '021_fix_recon_constraints.sql': `
        -- Remove NOT NULL constraints from deprecated year/month columns
        ALTER TABLE reconciliation_period ALTER COLUMN year DROP NOT NULL;
        ALTER TABLE reconciliation_period ALTER COLUMN month DROP NOT NULL;
      `,
      '022_monthly_revenue.sql': `
        -- Add monthly revenue breakdown columns
        ALTER TABLE reconciliation_line_item ADD COLUMN IF NOT EXISTS revenue_month_1 DECIMAL(15,2);
        ALTER TABLE reconciliation_line_item ADD COLUMN IF NOT EXISTS revenue_month_2 DECIMAL(15,2);
        ALTER TABLE reconciliation_line_item ADD COLUMN IF NOT EXISTS revenue_month_3 DECIMAL(15,2);
        ALTER TABLE reconciliation_line_item ADD COLUMN IF NOT EXISTS paying_customer_date DATE;

        COMMENT ON COLUMN reconciliation_line_item.revenue_month_1 IS 'Revenue for first month of period';
        COMMENT ON COLUMN reconciliation_line_item.revenue_month_2 IS 'Revenue for second month (quarterly only)';
        COMMENT ON COLUMN reconciliation_line_item.revenue_month_3 IS 'Revenue for third month (quarterly only)';
        COMMENT ON COLUMN reconciliation_line_item.paying_customer_date IS 'Date when customer became paying';
      `,
      '023_fix_null_event_times.sql': `
        -- Fix specific NULL event_time for salesautomation.systems (Dec 13, 2025)
        UPDATE domain_event de
        SET event_time = '2025-12-13 16:00:00-05'::timestamptz
        FROM attributed_domain ad
        WHERE de.attributed_domain_id = ad.id
          AND ad.domain = 'salesautomation.systems'
          AND de.event_source = 'PAYING_CUSTOMER'
          AND de.event_time IS NULL;
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

