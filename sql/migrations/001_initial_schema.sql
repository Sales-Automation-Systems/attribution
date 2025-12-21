-- Attribution Database Schema
-- Version: 1.0.0
-- Database: Railway PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Client configuration with UUID access tokens
CREATE TABLE IF NOT EXISTS client_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,              -- FK to production client.id
  client_name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL,
  access_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  rev_share_rate DECIMAL(5,4) DEFAULT 0.10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(slug, access_uuid),
  UNIQUE(client_id)
);

-- Domain-level attribution (one record per domain per client)
CREATE TABLE IF NOT EXISTS attributed_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID NOT NULL REFERENCES client_config(id),
  domain VARCHAR NOT NULL,
  first_email_sent_at TIMESTAMP,         -- When we first emailed this domain
  first_event_at TIMESTAMP,              -- When first success event occurred
  first_attributed_month VARCHAR,        -- YYYY-MM format
  has_positive_reply BOOLEAN DEFAULT FALSE,
  has_sign_up BOOLEAN DEFAULT FALSE,
  has_meeting_booked BOOLEAN DEFAULT FALSE,
  has_paying_customer BOOLEAN DEFAULT FALSE,
  is_within_window BOOLEAN DEFAULT FALSE,
  match_type VARCHAR,                    -- HARD_MATCH, SOFT_MATCH, NO_MATCH
  
  -- Dispute fields
  status VARCHAR DEFAULT 'ATTRIBUTED',   -- ATTRIBUTED, DISPUTED, REJECTED, CONFIRMED
  dispute_reason TEXT,
  dispute_submitted_at TIMESTAMP,
  dispute_resolved_at TIMESTAMP,
  dispute_resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_config_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_attributed_domain_client ON attributed_domain(client_config_id);
CREATE INDEX IF NOT EXISTS idx_attributed_domain_status ON attributed_domain(status);
CREATE INDEX IF NOT EXISTS idx_attributed_domain_match_type ON attributed_domain(match_type);

-- Individual events linked to a domain (for timeline view)
CREATE TABLE IF NOT EXISTS domain_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attributed_domain_id UUID NOT NULL REFERENCES attributed_domain(id),
  event_source VARCHAR NOT NULL,         -- EMAIL_SENT, EMAIL_RECEIVED, POSITIVE_REPLY, SIGN_UP, MEETING_BOOKED, PAYING_CUSTOMER
  event_time TIMESTAMP NOT NULL,
  email VARCHAR,                         -- The specific email involved
  source_id UUID,                        -- FK to source record (email_conversation.id or attribution_event.id)
  source_table VARCHAR,                  -- 'email_conversation' or 'attribution_event'
  metadata JSONB,                        -- Additional context (subject, campaign name, etc.)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_event_timeline ON domain_event(attributed_domain_id, event_time);
CREATE INDEX IF NOT EXISTS idx_domain_event_source ON domain_event(event_source);

-- Raw matching results (audit trail)
CREATE TABLE IF NOT EXISTS attribution_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID NOT NULL REFERENCES client_config(id),
  attribution_event_id UUID NOT NULL,   -- FK to production attribution_event.id
  attributed_domain_id UUID REFERENCES attributed_domain(id),
  prospect_id UUID,                      -- FK to production prospect.id (if matched)
  event_type VARCHAR NOT NULL,
  event_time TIMESTAMP NOT NULL,
  event_email VARCHAR,
  event_domain VARCHAR,
  match_type VARCHAR NOT NULL,           -- HARD_MATCH, SOFT_MATCH, NO_MATCH
  matched_email VARCHAR,
  email_sent_at TIMESTAMP,
  days_since_email INT,
  is_within_window BOOLEAN DEFAULT FALSE,
  match_reason TEXT,                     -- Why it matched or didn't match (for audit)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(attribution_event_id)
);

CREATE INDEX IF NOT EXISTS idx_attribution_match_client ON attribution_match(client_config_id);
CREATE INDEX IF NOT EXISTS idx_attribution_match_type ON attribution_match(match_type);

-- Monthly reconciliation periods
CREATE TABLE IF NOT EXISTS reconciliation_period (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID NOT NULL REFERENCES client_config(id),
  year INT NOT NULL,
  month INT NOT NULL,                    -- 0 = Pre-December 2025 (historical)
  status VARCHAR DEFAULT 'OPEN',         -- OPEN, SUBMITTED, LOCKED
  deadline TIMESTAMP,
  net_new_attributed INT DEFAULT 0,
  net_new_paying INT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  rev_share_rate DECIMAL(5,4),
  rev_share_amount DECIMAL(12,2) DEFAULT 0,
  submitted_at TIMESTAMP,
  locked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_config_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_period_client ON reconciliation_period(client_config_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_period_status ON reconciliation_period(status);

-- Individual revenue entries per paying customer (per domain)
CREATE TABLE IF NOT EXISTS reconciliation_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_period_id UUID NOT NULL REFERENCES reconciliation_period(id),
  attributed_domain_id UUID NOT NULL REFERENCES attributed_domain(id),
  revenue DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(reconciliation_period_id, attributed_domain_id)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_entry_period ON reconciliation_entry(reconciliation_period_id);

-- Personal email domains to exclude from soft matching
CREATE TABLE IF NOT EXISTS personal_email_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR NOT NULL UNIQUE
);

-- Processing job tracking
CREATE TABLE IF NOT EXISTS processing_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID REFERENCES client_config(id),
  job_type VARCHAR NOT NULL,             -- FULL_PROCESS, INCREMENTAL, SINGLE_CLIENT
  status VARCHAR DEFAULT 'PENDING',      -- PENDING, RUNNING, COMPLETED, FAILED
  total_events INT DEFAULT 0,
  processed_events INT DEFAULT 0,
  matched_hard INT DEFAULT 0,
  matched_soft INT DEFAULT 0,
  no_match INT DEFAULT 0,
  last_processed_event_id UUID,          -- For resumable processing
  last_checkpoint_at TIMESTAMP,
  batch_size INT DEFAULT 1000,
  current_batch INT DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_job_client ON processing_job(client_config_id);
CREATE INDEX IF NOT EXISTS idx_processing_job_status ON processing_job(status);

-- Event processing errors
CREATE TABLE IF NOT EXISTS event_processing_error (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_job_id UUID REFERENCES processing_job(id),
  attribution_event_id UUID,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_error_job ON event_processing_error(processing_job_id);

-- System logs for debugging
CREATE TABLE IF NOT EXISTS system_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR NOT NULL,              -- INFO, WARN, ERROR, DEBUG
  source VARCHAR NOT NULL,             -- 'worker', 'api', 'cron', 'ui'
  message TEXT NOT NULL,
  context JSONB,                       -- Additional structured data
  client_config_id UUID REFERENCES client_config(id),
  processing_job_id UUID REFERENCES processing_job(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_log_recent ON system_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_log_level ON system_log(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_log_source ON system_log(source, created_at DESC);

-- Worker heartbeat for monitoring
CREATE TABLE IF NOT EXISTS worker_heartbeat (
  id VARCHAR PRIMARY KEY DEFAULT 'main',
  last_heartbeat TIMESTAMP NOT NULL,
  status VARCHAR NOT NULL,             -- 'running', 'idle', 'processing'
  current_job_id UUID,
  metadata JSONB
);




